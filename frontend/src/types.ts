export interface Scenario {
  id: number;
  title: string;
  description: string;
}

export interface Session {
  id: number;
  scenario: string;
  date: string;
  duration?: string;
  score: number;
}

export interface Skill {
  name: string;
  score: number;
}

export interface Activity {
  id: number;
  title: string;
  time: string;
} 