'use client';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownLatexProps {
  content: string;
  className?: string;
}

export function MarkdownLatex({ content, className }: MarkdownLatexProps) {
  // 將 <br> 標籤轉換為 Markdown 支援的雙換行，以達到換行效果
  const processedContent = content.replace(/<br\s*\/?>/gi, '\n\n');

  return (
    <div className={`markdown-content ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
