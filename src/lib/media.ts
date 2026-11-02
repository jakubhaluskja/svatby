/** Veřejná adresa fotky webu v úložišti Supabase (bucket site-media). */
export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/site-media/${path}` : null;
}
