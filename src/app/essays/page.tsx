import Link from 'next/link'
import { getEssays } from '@/lib/essays'

export default function EssaysPage() {
  const essays = getEssays()

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to Shape Theory
        </Link>
        <h1 className="text-4xl font-bold mb-2">Shape Theory Essays</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {essays.length} essays on Shape Theory and its Applications
        </p>
      </div>

      {/* Essays list — oldest first */}
      <ol className="space-y-4">
        {essays.map((essay, idx) => (
          <li key={essay.slug}>
            <a
              href={essay.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block p-4 -mx-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-gray-400 font-mono text-sm mt-0.5 shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <span className="font-medium group-hover:text-blue-600 transition-colors">
                    {essay.title}
                  </span>
                  {essay.subtitle && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{essay.subtitle}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{essay.formattedDate}</p>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ol>

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
