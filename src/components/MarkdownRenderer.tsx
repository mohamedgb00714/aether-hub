import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: 'default' | 'purple' | 'emerald' | 'indigo' | 'dark';
}

/**
 * Reusable Markdown renderer component for AI responses
 * Uses ReactMarkdown with GitHub Flavored Markdown support
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '', 
  variant = 'default' 
}) => {
  // Define color schemes for different variants
  const variantStyles = {
    default: {
      text: 'text-slate-700',
      heading: 'text-slate-900',
      link: 'text-blue-600 hover:text-blue-800',
      code: 'bg-slate-100 text-slate-800',
      codeBlock: 'bg-slate-900 text-slate-100',
      blockquote: 'border-slate-400 bg-slate-50',
      table: 'divide-slate-300',
      tableHead: 'bg-slate-50',
      tableBorder: 'border-slate-200',
    },
    purple: {
      text: 'text-purple-900',
      heading: 'text-purple-900',
      link: 'text-purple-600 hover:text-purple-800',
      code: 'bg-purple-100 text-purple-800',
      codeBlock: 'bg-slate-900 text-slate-100',
      blockquote: 'border-purple-400 bg-purple-50',
      table: 'divide-purple-200',
      tableHead: 'bg-purple-50',
      tableBorder: 'border-purple-200',
    },
    emerald: {
      text: 'text-emerald-900',
      heading: 'text-emerald-900',
      link: 'text-emerald-600 hover:text-emerald-800',
      code: 'bg-emerald-100 text-emerald-800',
      codeBlock: 'bg-slate-900 text-slate-100',
      blockquote: 'border-emerald-400 bg-emerald-50',
      table: 'divide-emerald-200',
      tableHead: 'bg-emerald-50',
      tableBorder: 'border-emerald-200',
    },
    indigo: {
      text: 'text-indigo-900',
      heading: 'text-indigo-900',
      link: 'text-indigo-600 hover:text-indigo-800',
      code: 'bg-indigo-100 text-indigo-800',
      codeBlock: 'bg-slate-900 text-slate-100',
      blockquote: 'border-indigo-400 bg-indigo-50',
      table: 'divide-indigo-200',
      tableHead: 'bg-indigo-50',
      tableBorder: 'border-indigo-200',
    },
    dark: {
      text: 'text-slate-200',
      heading: 'text-white',
      link: 'text-blue-400 hover:text-blue-300',
      code: 'bg-white/20 text-white',
      codeBlock: 'bg-black/30 text-slate-100',
      blockquote: 'border-white/40 bg-white/10',
      table: 'divide-white/20',
      tableHead: 'bg-white/10',
      tableBorder: 'border-white/20',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={`prose prose-sm max-w-none ${styles.text} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children, ...props }: any) => (
            <h1 className={`text-xl font-bold ${styles.heading} mb-3 mt-4`} {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }: any) => (
            <h2 className={`text-lg font-bold ${styles.heading} mb-2 mt-3`} {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }: any) => (
            <h3 className={`text-base font-semibold ${styles.heading} mb-2 mt-2`} {...props}>
              {children}
            </h3>
          ),
          // Paragraphs
          p: ({ children, ...props }: any) => (
            <p className="mb-2 leading-relaxed" {...props}>
              {children}
            </p>
          ),
          // Links - open external links in system browser
          a: ({ href, children, ...props }: any) => (
            <a
              href={href}
              className={`${styles.link} underline font-medium`}
              onClick={(e) => {
                e.preventDefault();
                if (href && window.electronAPI?.shell?.openExternal) {
                  window.electronAPI.shell.openExternal(href);
                } else if (href) {
                  window.open(href, '_blank');
                }
              }}
              {...props}
            >
              {children}
            </a>
          ),
          // Code
          code: ({ inline, children, className: codeClassName, ...props }: any) => {
            return inline ? (
              <code 
                className={`${styles.code} px-1.5 py-0.5 rounded text-sm font-mono`} 
                {...props}
              >
                {children}
              </code>
            ) : (
              <code 
                className={`${styles.codeBlock} text-sm font-mono`} 
                {...props}
              >
                {children}
              </code>
            );
          },
          // Pre (code blocks)
          pre: ({ children, ...props }: any) => (
            <pre 
              className={`${styles.codeBlock} p-4 rounded-lg overflow-x-auto my-3`} 
              {...props}
            >
              {children}
            </pre>
          ),
          // Lists
          ul: ({ children, ...props }: any) => (
            <ul className="list-disc list-inside space-y-1 my-2 ml-2" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }: any) => (
            <ol className="list-decimal list-inside space-y-1 my-2 ml-2" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }: any) => (
            <li className="leading-relaxed" {...props}>
              {children}
            </li>
          ),
          // Blockquotes
          blockquote: ({ children, ...props }: any) => (
            <blockquote 
              className={`border-l-4 ${styles.blockquote} pl-4 py-2 my-3 italic`} 
              {...props}
            >
              {children}
            </blockquote>
          ),
          // Tables
          table: ({ children, ...props }: any) => (
            <div className="overflow-x-auto my-3">
              <table 
                className={`min-w-full divide-y ${styles.table} text-sm border rounded-lg`} 
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }: any) => (
            <thead className={styles.tableHead} {...props}>
              {children}
            </thead>
          ),
          th: ({ children, ...props }: any) => (
            <th className="px-3 py-2 text-left font-semibold" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }: any) => (
            <td className={`px-3 py-2 ${styles.tableBorder} border-t`} {...props}>
              {children}
            </td>
          ),
          // Horizontal rule
          hr: (props: any) => (
            <hr className="my-4 border-current opacity-20" {...props} />
          ),
          // Strong/Bold
          strong: ({ children, ...props }: any) => (
            <strong className="font-bold" {...props}>
              {children}
            </strong>
          ),
          // Emphasis/Italic
          em: ({ children, ...props }: any) => (
            <em className="italic" {...props}>
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
