import { Routes } from '@angular/router';
import { HomeComponent } from '../comps/home/home.component';
import { CategoriesComponent } from '../comps/categories/categories.component';
import { RecipesComponent } from '../comps/recipes/recipes.component';
import { RecipeDetailsComponent } from '../comps/recipe-details/recipe-details.component';
import { LoginComponent } from '../comps/login/login.component';
import { ProfileComponent } from '../comps/profile/profile.component';
import { PublicProfileComponent } from '../comps/public-profile/public-profile.component';
import { AdminComponent } from '../comps/admin/admin.component';

/**
 * נתיבי האפליקציה
 * 
 * ארכיטקטורה נקייה:
 * - /home - דף הבית
 * - /categories - תצוגת כל הקטגוריות
 * - /recipes/:category - מתכונים בקטגוריה ספציפית (הקטגוריה ב-URL!)
 * - /recipe/:id - פרטי מתכון
 * - /login - התחברות והרשמה
 * - /profile - הפרופיל האישי שלי
 * - /public-profile/:id - פרופיל ציבורי של משתמש
 * - /my-recipes - המתכונים שלי
 * - /my-favorites - המועדפים שלי
 * - /admin - פאנל ניהול (רק למנהלים)
 * 
 * היתרונות:
 * - URLs ברורים וניתנים לשיתוף
 * - לא צריך state או storage
 * - הפרדת concerns מושלמת
 */
export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'categories', component: CategoriesComponent },
  { path: 'recipes', component: RecipesComponent }, // ← ✅ חובה!
  { path: 'recipes/:category', component: RecipesComponent },
  { path: 'recipe/:id', component: RecipeDetailsComponent },
  { path: 'login', component: LoginComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'public-profile/:id', component: PublicProfileComponent },
  { path: 'admin', component: AdminComponent }
];