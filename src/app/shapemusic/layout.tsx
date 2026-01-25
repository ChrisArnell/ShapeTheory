import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shape Music - A Shape Theory App',
  description: 'Discover your music shape and find music that fits',
}

export default function ShapeMusicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
