import Link from 'next/link';

interface PageProps {
  params: {
    id: string;
  };
}

export default function PracticeSessionPage({ params }: PageProps) {
  const { id } = params;
  
  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Practice Session</h1>
          <Link 
            href="/practice" 
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Back to Scenarios
          </Link>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {id === '1' ? 'Job Interview' : 
               id === '2' ? 'Daily Conversation' :
               id === '3' ? 'Business Meeting' :
               id === '4' ? 'Travel Situations' : 'Custom Scenario'}
            </h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              In Progress
            </span>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <p className="text-gray-700">
              {id === '1' ? 'Practice answering common job interview questions' : 
               id === '2' ? 'Practice everyday conversations in English' :
               id === '3' ? 'Practice participating in business meetings' :
               id === '4' ? 'Practice conversations you might have while traveling' : 'Custom scenario description'}
            </p>
          </div>
          
          <div className="border rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-50 p-4 border-b">
              <h3 className="font-medium">Conversation</h3>
            </div>
            <div className="p-6 max-h-80 overflow-y-auto">
              <div className="flex mb-4">
                <div className="bg-blue-100 rounded-lg p-3 max-w-[80%]">
                  <p className="text-blue-800">Hello! I'm your AI speaking partner. What position are you interviewing for today?</p>
                </div>
              </div>
              
              <div className="flex justify-end mb-4">
                <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                  <p>I'm interviewing for a software developer position.</p>
                </div>
              </div>
              
              <div className="flex mb-4">
                <div className="bg-blue-100 rounded-lg p-3 max-w-[80%]">
                  <p className="text-blue-800">Great! Could you tell me about your experience and why you're interested in this role?</p>
                </div>
              </div>
              
              <div className="flex justify-end mb-4">
                <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                  <p>I have 3 years of experience as a front-end developer. I'm passionate about creating user-friendly interfaces...</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col">
            <div className="flex space-x-4 mb-4">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors">
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                  </svg>
                  <span>Start Speaking</span>
                </div>
              </button>
              
              <button className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 py-3 px-4 rounded-lg transition-colors">
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>Take a Break</span>
                </div>
              </button>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">Session Time: 5:23</p>
              <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-1 bg-blue-600 w-1/3"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Real-time Feedback</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium">Pronunciation</span>
                <span className="text-green-600">Good</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full w-4/5"></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium">Grammar</span>
                <span className="text-yellow-600">Needs Improvement</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-600 h-2 rounded-full w-3/5"></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium">Fluency</span>
                <span className="text-blue-600">Excellent</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full w-9/10"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 