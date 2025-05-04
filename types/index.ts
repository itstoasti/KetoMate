export interface Macro {
  carbs: number;
  protein: number;
  fat: number;
  calories: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  servingSize: string;
  macros: Macro;
  barcode?: string;
  ketoRating: 'Keto-Friendly' | 'Limit' | 'Strictly Limit' | 'Avoid';
  dateAdded: string;
  description?: string;
}

export interface Meal {
  id: string;
  name: string;
  foods: Food[];
  date: string;
  time: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  macros: Macro;
}

export interface DailyMacros {
  date: string;
  total: Macro;
  limit: Macro;
  remaining: Macro;
  meals: Meal[];
}

export interface UserProfile {
  id: string;
  name: string;
  weight: number;
  height: number;
  weightUnit: 'kg' | 'lb';
  heightUnit: 'cm' | 'ft';
  goal: 'weight_loss' | 'maintenance' | 'muscle_gain';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  dailyMacroLimit: Macro;
  dailyCalorieLimit: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  unit: 'kg' | 'lb';
  notes?: string;
}

export interface AIMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}