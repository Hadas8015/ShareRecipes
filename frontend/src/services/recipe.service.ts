// שירות ניהול מתכונים - CRUD, דירוג וחיפוש חכם

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Recipe } from '../classes/recipe';

@Injectable({
  providedIn: 'root'
})
export class RecipeService {
  private baseUrl = 'http://127.0.0.1:5000';

  constructor(private http: HttpClient) { }

  // ================== GET Recipes ==================

  /* הבאת כל המתכונים */
  getAllRecipes(): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(`${this.baseUrl}/recipes`);
  }
  
  /* הבאת מתכון בודד לפי ID */
  getRecipeById(id: number): Observable<Recipe> {
    return this.http.get<Recipe>(`${this.baseUrl}/recipes/${id}`);
  }

  /* הבאת כל המתכונים של משתמש מסוים */
  getUserRecipes(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/user/${userId}/recipes`);
  }

  /* הבאת מתכונים עם פרמטרים (סינון ומיון) */
  getRecipesWithParams(params: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/recipes`, { params });
  }

  // ================== Create / Update / Delete ==================

  /* יצירת מתכון חדש */
  createRecipe(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/recipes`, formData);
  }

  /* עדכון מתכון קיים */
  updateRecipe(recipeId: number, formData: FormData): Observable<any> {
    return this.http.put(`${this.baseUrl}/recipes/${recipeId}`, formData);
  }

  /* מחיקת מתכון (Admin בלבד) */
  deleteRecipe(recipeId: number, userId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/recipes/${recipeId}?user_id=${userId}`);
  }

  // ================== Rating ==================

  /* דירוג מתכון */
  rateRecipe(recipeId: number, rating: number, userId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/recipes/${recipeId}/rate`, {
      rating,
      user_id: userId
    });
  }

  // ================== Smart Search ==================

  /* חיפוש חכם לפי רכיבים */
  searchByIngredients(ingredients: string[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.baseUrl}/recipes/search`, {
      my_ingredients: ingredients
    });
  }
}