export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">Your Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Total Practice Time</h2>
            <p className="text-3xl font-bold text-blue-600">12.5 hours</p>
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Sessions Completed</h2>
            <p className="text-3xl font-bold text-blue-600">24</p>
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Average Score</h2>
            <p className="text-3xl font-bold text-blue-600">7.8/10</p>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Practice History</h2>
          <div className="space-y-4">
            <div className="border-b pb-4">
              <div className="flex justify-between">
                <h3 className="font-medium">Job Interview</h3>
                <span>May 15, 2023</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Score: 8.5/10</p>
            </div>
            
            <div className="border-b pb-4">
              <div className="flex justify-between">
                <h3 className="font-medium">Daily Conversation</h3>
                <span>May 12, 2023</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Score: 7.8/10</p>
            </div>
            
            <div className="border-b pb-4">
              <div className="flex justify-between">
                <h3 className="font-medium">Business Meeting</h3>
                <span>May 10, 2023</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Score: 6.5/10</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 