// מבנה נתונים של מתכון - כולל רכיבים, שלבי הכנה ודירוג

export interface Recipe {
  id: number;
  name: string;
  image_path: string;
  variation_paths?: string[];
  type: 'Meat' | 'Dairy' | 'Parve';
  category: 'Cakes' | 'Desserts' | 'Breakfast' | 'MainDish' | 'Salads' | 'Baked' | 'Fish' | 'FastFood' | 'Soups';
  preparation_time: number;
  
  // תאימות אחורה - למתכונים ישנים
  instructions?: string;
  
  // שלבים חדשים - למתכונים חדשים
  steps?: Step[];
  
  rating: number;
  rating_count?: number;
  ingredients: Ingredient[];
}

export interface Ingredient {
  product: string;
  amount: string;
  unit: string;
}

export interface Step {
  text: string;                // תוכן השלב
  ingredientsUsed: string[];   // רכיבים שזוהו אוטומטית
  duration?: number;           // זמן (אופציונלי)
  durationUnit?: string;       // יחידת זמן
}