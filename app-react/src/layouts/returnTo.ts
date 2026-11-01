import { useLocation } from 'react-router-dom'

const INVITE = /^\/yatra\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\/join$/i

/** The only path allowed through an emailed link. Anything else could send a new user to another site. */
export const invitePath = (path?: string | null) => (path && INVITE.test(path) ? path : undefined)

/** Where to go once signed in: the page that sent the visitor to Sign in, or the invite on an emailed link. */
export function useReturnTo(): string | undefined {
  const { state, search } = useLocation()
  return (state as { from?: string } | null)?.from ?? invitePath(new URLSearchParams(search).get('next'))
}
