'use client';

import { useEffect, useState } from 'react';

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/\s*\.\s*/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}-]/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

import ReactMarkdown from 'react-markdown';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { BookOpen } from 'lucide-react';

export default function ManualPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch('/manual.md')
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent('# Error al cargar el manual\nNo se pudo cargar el contenido.'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (user === null) router.replace('/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <AdminLayout title="Manual de Usuario" backHref="/admin/dashboard" backLabel="Dashboard">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-slate-600">
          <BookOpen size={24} />
          <p className="text-sm">Documentación completa de OmniNexus Pro</p>
        </div>
        <div className="card overflow-hidden">
          <div className="p-6 sm:p-8 prose prose-slate max-w-none prose-headings:text-slate-800 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-8 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2 prose-h3:text-lg prose-h3:mt-6 prose-p:text-slate-600 prose-li:text-slate-600 prose-table:text-sm prose-th:bg-slate-100 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-slate-900 prose-pre:text-slate-100">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a href={href} className="text-blue-600 hover:underline">
                      {children}
                    </a>
                  ),
                  h1: ({ children }) => (
                    <h1 id={slugify(String(children))}>{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 id={slugify(String(children))}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 id={slugify(String(children))}>{children}</h3>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
