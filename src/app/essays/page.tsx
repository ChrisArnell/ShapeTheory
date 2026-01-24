import Link from 'next/link'
import { getEssays } from '@/lib/essays'

export const revalidate = 3600 // Revalidate every hour

export default async function EssaysPage() {
  const essays = await getEssays()

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to Shape Theory
        </Link>
        <h1 className="text-4xl font-bold mb-2">Shape Theory Essays</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Essays on Shape Theory and its Applications
        </p>
      </div>

      {/* Table of Contents */}
      <nav className="mb-16 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Contents</h2>
        <ol className="space-y-3">
          {essays.map((essay, idx) => (
            <li key={essay.slug}>
              <a
                href={`#${essay.slug}`}
                className="group flex items-start gap-3 hover:text-blue-600 transition-colors"
              >
                <span className="text-gray-400 font-mono text-sm mt-0.5">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div>
                  <span className="font-medium group-hover:underline">{essay.title}</span>
                  {essay.subtitle && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{essay.subtitle}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{essay.date}</p>
                </div>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Essays */}
      <div className="space-y-24">
        {essays.map((essay, idx) => (
          <article key={essay.slug} id={essay.slug} className="scroll-mt-8">
            {/* Essay header */}
            <header className="mb-8 pb-4 border-b dark:border-gray-700">
              <p className="text-sm text-gray-400 font-mono mb-2">
                {String(idx + 1).padStart(2, '0')}
              </p>
              <h2 className="text-3xl font-bold mb-2">{essay.title}</h2>
              {essay.subtitle && (
                <p className="text-lg text-gray-600 dark:text-gray-400 italic">{essay.subtitle}</p>
              )}
              <p className="text-sm text-gray-400 mt-2">{essay.date}</p>
            </header>

            {/* Essay content */}
            <div
              className="prose prose-gray dark:prose-invert max-w-none
                prose-headings:font-bold prose-headings:mt-8 prose-headings:mb-4
                prose-p:mb-4 prose-p:leading-relaxed
                prose-a:text-blue-600 prose-a:hover:underline
                prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic
                prose-img:rounded-lg prose-img:mx-auto
                prose-li:mb-1"
              dangerouslySetInnerHTML={{ __html: essay.content }}
            />

            {/* Back to top */}
            <div className="mt-8 pt-4">
              <a href="#" className="text-sm text-gray-400 hover:text-gray-600">
                &uarr; Back to top
              </a>
            </div>
          </article>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-24 pt-8 border-t dark:border-gray-700 text-center text-sm text-gray-400">
        <a
          href="https://shapetheoryesvn.substack.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600"
        >
          Subscribe on Substack &rarr;
        </a>
      </footer>
    </div>
  )
}
