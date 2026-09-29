import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = ['/login'];

// Refreshes the Supabase session cookie on every request and keeps signed-out
// visitors on the login page. Pages and API routes still re-check membership
// themselves (lib/auth.ts); this is the first gate, not the only one.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, extraHeaders) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(extraHeaders ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(path);

  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = '';
    if (target === '/login' && path !== '/') url.searchParams.set('next', path);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user) {
    if (isPublic) return response;
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
    }
    return redirectTo('/login');
  }

  if (isPublic) return redirectTo('/');

  const mustChange = user.app_metadata?.must_change_password === true;
  if (mustChange && path !== '/set-password' && !path.startsWith('/api/account') && !path.startsWith('/auth/')) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Please set a new password first.' }, { status: 403 });
    }
    return redirectTo('/set-password');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|woff2?)$).*)'],
};
