import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col">
        <h1 className="text-4xl font-bold mb-8">Speaking Practice Platform</h1>
        <p className="text-xl mb-8">AI-powered speaking practice with real-time feedback</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <Link 
            href="/practice"
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30 flex flex-col items-center"
          >
            <h2 className="mb-3 text-2xl font-semibold">
              Start Practice{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="text-center">Begin a new conversation with an AI speaking partner.</p>
          </Link>

          <Link
            href="/dashboard"
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30 flex flex-col items-center"
          >
            <h2 className="mb-3 text-2xl font-semibold">
              Dashboard{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="text-center">View your progress and previous practice sessions.</p>
          </Link>
        </div>

        <div className="mt-16 grid text-center lg:max-w-3xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left">
          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
            <h2 className="mb-3 text-xl font-semibold">
              Multiple Scenarios
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-70">
              Practice for job interviews, daily conversations, presentations, and more!
            </p>
          </div>

          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
            <h2 className="mb-3 text-xl font-semibold">
              Instant Feedback
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-70">
              Get real-time feedback on pronunciation, grammar, and fluency.
            </p>
          </div>

          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
            <h2 className="mb-3 text-xl font-semibold">
              Track Progress
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-70">
              See your improvement over time with detailed analytics.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
} 