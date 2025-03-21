import React from 'react';
import Link from 'next/link';

export default function PracticePage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Speaking Practice</h1>
          <Link 
            href="/" 
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Choose a Scenario</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                className="flex flex-col items-start p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <h3 className="font-medium text-lg">{scenario.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>
                <div className="mt-2 flex items-center text-sm text-blue-600">
                  <span>Start Scenario</span>
                  <svg className="w-4 h-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Practice Sessions</h2>
          {recentSessions.length > 0 ? (
            <div className="divide-y">
              {recentSessions.map((session) => (
                <div key={session.id} className="py-3">
                  <div className="flex justify-between">
                    <h3 className="font-medium">{session.scenario}</h3>
                    <span className="text-sm text-gray-500">{session.date}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Score: {session.score}/10</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No recent practice sessions</p>
          )}
        </div>
      </div>
    </main>
  );
}

// Mock data
const scenarios = [
  {
    id: 1,
    title: 'Job Interview',
    description: 'Practice answering common job interview questions',
  },
  {
    id: 2,
    title: 'Daily Conversation',
    description: 'Practice everyday conversations in English',
  },
  {
    id: 3,
    title: 'Business Meeting',
    description: 'Practice participating in business meetings',
  },
  {
    id: 4,
    title: 'Travel Situations',
    description: 'Practice conversations you might have while traveling',
  },
];

const recentSessions = [
  {
    id: 1,
    scenario: 'Job Interview',
    date: '2 days ago',
    score: 8,
  },
  {
    id: 2,
    scenario: 'Daily Conversation',
    date: '5 days ago',
    score: 7,
  },
]; 