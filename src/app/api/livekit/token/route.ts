import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const roomName = searchParams.get('roomName')
    const participantName = searchParams.get('participantName')

    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'roomName and participantName are required' },
        { status: 400 }
      )
    }

    const apiKey    = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 }
      )
    }

    // Verify the session exists in DB and is live or scheduled
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, teacher_id, status')
      .eq('room_name', roomName)
      .single()

    if (session) {
      // Session found — check authorization
      const isTeacher = session.teacher_id === user.id

      if (!isTeacher) {
        // Check if student is targeted (directly or via group)
        const { data: directTarget } = await supabase
          .from('session_targets')
          .select('id')
          .eq('session_id', session.id)
          .eq('target_type', 'student')
          .eq('target_id', user.id)
          .limit(1)

        let hasGroupTarget = false
        if (!directTarget || directTarget.length === 0) {
          const { data: myGroups } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('student_id', user.id)

          if (myGroups && myGroups.length > 0) {
            const gids = myGroups.map(g => g.group_id)
            const { data: groupTarget } = await supabase
              .from('session_targets')
              .select('id')
              .eq('session_id', session.id)
              .eq('target_type', 'group')
              .in('target_id', gids)
              .limit(1)

            hasGroupTarget = (groupTarget && groupTarget.length > 0) || false
          }
        }

        if ((!directTarget || directTarget.length === 0) && !hasGroupTarget) {
          return NextResponse.json({ error: 'You are not authorized to join this session' }, { status: 403 })
        }
      }

      if (session.status === 'ended') {
        return NextResponse.json({ error: 'This session has ended' }, { status: 400 })
      }
    }
    // If no session found, allow joining (supports ad-hoc rooms via Join Room)

    // Dynamic import for ESM-only livekit-server-sdk
    const { AccessToken } = await import('livekit-server-sdk')

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      ttl: '1h',
    })

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const token = await at.toJwt()

    return NextResponse.json({ token })
  } catch (err: unknown) {
    console.error('LiveKit token error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error generating token'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

