import { z } from 'zod';

export const ModelFixtureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  scenarioId: z.string(),
  version: z.string(),
  summary: z.string(),
  usageMetadata: z.object({
    promptTokens: z.number(),
    candidatesTokens: z.number(),
    totalTokens: z.number(),
    durationMs: z.number(),
  }),
  files: z.array(
    z.object({
      path: z.string(),
      responsibility: z.string(),
      fileType: z.enum(['page', 'component', 'layout', 'api', 'lib', 'config', 'style', 'asset']),
      content: z.string(),
    })
  ),
});

export type ModelFixture = z.infer<typeof ModelFixtureSchema>;

/**
 * Fixture: DevOps Pulse SaaS Landing Page (bench_01_saas_landing)
 * Fully compliant Next.js 16 App Router application with Turbopack root resolution,
 * accessible semantic HTML landmarks, responsive viewport overflow adherence, and zero console errors.
 */
export const DEVOPS_PULSE_FIXTURE: ModelFixture = {
  id: 'fixture_devops_pulse_v1',
  name: 'DevOps Pulse SaaS Landing Page Fixture',
  description: 'Recorded model synthesis for Kubernetes observability SaaS landing page',
  scenarioId: 'bench_01_saas_landing',
  version: '1.0.0',
  summary: 'Synthesized high-converting Kubernetes observability landing page with pricing tiers and cluster telemetry',
  usageMetadata: {
    promptTokens: 890,
    candidatesTokens: 5420,
    totalTokens: 6310,
    durationMs: 4200,
  },
  files: [
    {
      path: 'package.json',
      responsibility: 'Project dependencies and build scripts',
      fileType: 'config',
      content: JSON.stringify(
        {
          name: 'devops-pulse-landing',
          version: '1.0.0',
          private: true,
          scripts: {
            build: 'next build',
            start: 'next start -p 3000 -H 0.0.0.0',
          },
          dependencies: {
            next: '^16.4.3',
            react: '^19.3.0',
            'react-dom': '^19.3.0',
            'lucide-react': '^1.61.0',
          },
          devDependencies: {
            typescript: '^5.4.0',
            '@types/node': '^22.0.0',
            '@types/react': '^19',
            '@types/react-dom': '^19',
          },
        },
        null,
        2
      ),
    },
    {
      path: 'tsconfig.json',
      responsibility: 'TypeScript compiler configuration',
      fileType: 'config',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'es5',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'react-jsx',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./src/*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
          exclude: ['node_modules'],
        },
        null,
        2
      ),
    },
    {
      path: 'next.config.mjs',
      responsibility: 'Turbopack build configuration and root resolution',
      fileType: 'config',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: '/home/node',
  },
};
export default nextConfig;\n`,
    },
    {
      path: 'src/app/globals.css',
      responsibility: 'Global styling and responsive resets',
      fileType: 'style',
      content: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          width: 100%;
          overflow-x: hidden;
          background: #09090b;
          color: #fafafa;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
      `,
    },
    {
      path: 'src/app/layout.tsx',
      responsibility: 'Root HTML layout',
      fileType: 'layout',
      content: `
        import './globals.css';
        export const metadata = {
          title: 'DevOps Pulse — Real-Time Kubernetes Observability',
          description: 'Autonomous telemetry and incident resolution for cloud-native Kubernetes clusters',
        };

        export default function RootLayout({ children }: { children: React.ReactNode }) {
          return (
            <html lang="en">
              <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
              </head>
              <body style={{ margin: 0, padding: 0, overflowX: 'hidden', background: '#09090b', color: '#fafafa' }}>
                {children}
              </body>
            </html>
          );
        }
      `,
    },
    {
      path: 'src/components/HeaderNav.tsx',
      responsibility: 'Accessible navigation header with brand and anchor links',
      fileType: 'component',
      content: `
        'use client';
        import React from 'react';

        export function HeaderNav() {
          return (
            <header
              role="banner"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: '1px solid #27272a',
                background: 'rgba(9, 9, 11, 0.95)',
                position: 'sticky',
                top: 0,
                zIndex: 50,
                width: '100%',
                maxWidth: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#6366f1' }} />
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>DevOps Pulse</span>
              </div>
              <nav aria-label="Main Navigation" style={{ display: 'flex', gap: '20px' }}>
                <a href="#features" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: '14px' }}>Features</a>
                <a href="#pricing" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: '14px' }}>Pricing</a>
                <a href="#clusters" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: '14px' }}>Clusters</a>
              </nav>
              <div>
                <a
                  href="#pricing"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: '#4f46e5',
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  Start Free Trial
                </a>
              </div>
            </header>
          );
        }
      `,
    },
    {
      path: 'src/components/PricingMatrix.tsx',
      responsibility: '3-tier pricing matrix with feature comparison',
      fileType: 'component',
      content: `
        'use client';
        import React, { useState } from 'react';

        export function PricingMatrix() {
          const [annual, setAnnual] = useState(false);

          const tiers = [
            {
              id: 'starter',
              name: 'Starter',
              price: annual ? '$24' : '$29',
              period: '/mo',
              desc: 'For small dev teams monitoring up to 5 clusters.',
              features: ['Up to 5 K8s clusters', '24h metric retention', 'Community Slack alerts', 'Standard dashboards'],
              cta: 'Start Free Trial',
              popular: false,
            },
            {
              id: 'team',
              name: 'Team',
              price: annual ? '$69' : '$79',
              period: '/mo',
              desc: 'For fast-growing organizations with production workloads.',
              features: ['Up to 25 K8s clusters', '30-day retention', 'PagerDuty & Slack integration', 'AI Root Cause Analysis'],
              cta: 'Start Free Trial',
              popular: true,
            },
            {
              id: 'enterprise',
              name: 'Enterprise',
              price: 'Custom',
              period: '',
              desc: 'For large enterprises requiring strict SLAs and compliance.',
              features: ['Unlimited clusters', '365-day retention', 'Custom SSO & RBAC', 'Dedicated 24/7 SRE support'],
              cta: 'Book Demo',
              popular: false,
            },
          ];

          return (
            <section id="pricing" style={{ padding: '64px 20px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px', color: '#ffffff' }}>Transparent, Scalable Pricing</h2>
                <p style={{ color: '#a1a1aa', fontSize: '16px' }}>Choose the observability plan tailored to your infrastructure scale.</p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '20px', background: '#18181b', padding: '4px', borderRadius: '8px' }}>
                  <button
                    onClick={() => setAnnual(false)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: !annual ? '#27272a' : 'transparent',
                      color: !annual ? '#ffffff' : '#71717a',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    Monthly Billing
                  </button>
                  <button
                    onClick={() => setAnnual(true)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: annual ? '#27272a' : 'transparent',
                      color: annual ? '#ffffff' : '#71717a',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    Annual (Save 20%)
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '24px',
                  width: '100%',
                }}
              >
                {tiers.map((t) => (
                  <div
                    key={t.id}
                    data-testid="pricing-tier-card"
                    style={{
                      background: '#18181b',
                      border: t.popular ? '2px solid #6366f1' : '1px solid #27272a',
                      borderRadius: '12px',
                      padding: '32px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                    }}
                  >
                    {t.popular && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-12px',
                          right: '24px',
                          background: '#6366f1',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Most Popular
                      </span>
                    )}
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>{t.name}</h3>
                      <p style={{ color: '#a1a1aa', fontSize: '13px', margin: '8px 0 20px' }}>{t.desc}</p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '24px' }}>
                        <span style={{ fontSize: '36px', fontWeight: 800, color: '#ffffff' }}>{t.price}</span>
                        <span style={{ color: '#71717a', fontSize: '14px' }}>{t.period}</span>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {t.features.map((f, i) => (
                          <li key={i} style={{ color: '#d4d4d8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#22c55e' }}>✓</span> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: t.popular ? '#4f46e5' : '#27272a',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {t.cta}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        }
      `,
    },
    {
      path: 'src/app/page.tsx',
      responsibility: 'Main landing page combining Hero, Cluster Telemetry, and Pricing',
      fileType: 'page',
      content: `
        'use client';
        import React from 'react';
        import { HeaderNav } from '../components/HeaderNav';
        import { PricingMatrix } from '../components/PricingMatrix';

        export default function Page() {
          return (
            <main role="main" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden' }}>
              <HeaderNav />

              {/* Hero Section */}
              <section
                style={{
                  padding: '80px 20px 60px',
                  textAlign: 'center',
                  maxWidth: '900px',
                  margin: '0 auto',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '20px',
                  }}
                >
                  Kubernetes Incident Intelligence v2.4 Live
                </div>
                <h1
                  style={{
                    fontSize: '44px',
                    fontWeight: 800,
                    lineHeight: 1.15,
                    marginBottom: '20px',
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Autonomous Kubernetes Observability & Real-Time Incident Response
                </h1>
                <p
                  style={{
                    fontSize: '18px',
                    color: '#a1a1aa',
                    lineHeight: 1.6,
                    maxWidth: '720px',
                    margin: '0 auto 36px',
                  }}
                >
                  Eliminate cluster downtime with continuous eBPF telemetry, automatic pod anomaly diagnosis, and sub-second alert mitigation across all nodes.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <a
                    href="#pricing"
                    style={{
                      padding: '14px 28px',
                      borderRadius: '8px',
                      background: '#4f46e5',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontSize: '16px',
                      fontWeight: 600,
                      boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                    }}
                  >
                    Start Free Trial
                  </a>
                  <a
                    href="#pricing"
                    style={{
                      padding: '14px 28px',
                      borderRadius: '8px',
                      background: '#27272a',
                      color: '#fafafa',
                      textDecoration: 'none',
                      fontSize: '16px',
                      fontWeight: 600,
                    }}
                  >
                    Book Demo
                  </a>
                </div>
              </section>

              {/* Cluster Preview Cards */}
              <section id="clusters" style={{ padding: '20px 20px 60px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
                <div
                  style={{
                    background: '#18181b',
                    borderRadius: '12px',
                    border: '1px solid #27272a',
                    padding: '24px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #27272a', paddingBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#a1a1aa' }}>Connected Kubernetes Clusters (Production)</span>
                    <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>● 3/3 Clusters Healthy</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <div style={{ background: '#09090b', padding: '16px', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ fontSize: '12px', color: '#71717a' }}>us-east-1-prod-k8s</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, margin: '6px 0', color: '#ffffff' }}>48 Nodes</div>
                      <div style={{ fontSize: '12px', color: '#22c55e' }}>99.99% Availability</div>
                    </div>
                    <div style={{ background: '#09090b', padding: '16px', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ fontSize: '12px', color: '#71717a' }}>eu-central-1-k8s</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, margin: '6px 0', color: '#ffffff' }}>32 Nodes</div>
                      <div style={{ fontSize: '12px', color: '#22c55e' }}>100% Availability</div>
                    </div>
                    <div style={{ background: '#09090b', padding: '16px', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ fontSize: '12px', color: '#71717a' }}>ap-northeast-k8s</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, margin: '6px 0', color: '#ffffff' }}>16 Nodes</div>
                      <div style={{ fontSize: '12px', color: '#22c55e' }}>99.98% Availability</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Pricing Section */}
              <PricingMatrix />

              {/* Footer */}
              <footer role="contentinfo" style={{ marginTop: 'auto', borderTop: '1px solid #27272a', padding: '32px 20px', textAlign: 'center', color: '#71717a', fontSize: '14px' }}>
                <p>© 2026 DevOps Pulse Platform Inc. All rights reserved. Zero vendor lock-in telemetry.</p>
              </footer>
            </main>
          );
        }
      `,
    },
  ],
};

