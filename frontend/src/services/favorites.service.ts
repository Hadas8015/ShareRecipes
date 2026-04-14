// שירות ניהול מועדפים - תמיכה במשתמש מחובר (שרת) ואורח (localStorage)

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private apiUrl = 'http://127.0.0.1:5000';
  private localStorageKey = 'favoriteRecipes';
  
  private favoritesSubject = new BehaviorSubject<number[]>(this.getLocalFavorites());
  public favorites$ = this.favoritesSubject.asObservable();

  constructor(private http: HttpClient) {}

  /* שליפת מועדפים מ-localStorage */
  private getLocalFavorites(): number[] {
    const stored = localStorage.getItem(this.localStorageKey);
    return stored ? JSON.parse(stored) : [];
  }

  /* שמירת מועדפים ב-localStorage + עדכון ה-Subject */
  private saveLocalFavorites(favorites: number[]): void {
    localStorage.setItem(this.localStorageKey, JSON.stringify(favorites));
    this.favoritesSubject.next(favorites);
  }

  /* בדיקה האם מתכון במועדפים המקומיים */
  isLocalFavorite(recipeId: number): boolean {
    return this.getLocalFavorites().includes(recipeId);
  }

  /* הוספה/הסרה מהמועדפים המקומיים */
  toggleLocalFavorite(recipeId: number): void {
    const favorites = this.getLocalFavorites();
    const updated = favorites.includes(recipeId)
      ? favorites.filter(id => id !== recipeId)
      : [...favorites, recipeId];
    this.saveLocalFavorites(updated);
  }

  /* הוספה למועדפים בשרת */
  addFavorite(recipeId: number, userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/recipes/${recipeId}/favorite`, { user_id: userId });
  }

  /* הסרה מהמועדפים בשרת */
  removeFavorite(recipeId: number, userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/recipes/${recipeId}/favorite?user_id=${userId}`);
  }

  /* בדיקה האם מתכון במועדפים בשרת */
  checkIfFavorite(recipeId: number, userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/recipes/${recipeId}/is_favorite?user_id=${userId}`);
  }

  /* שליפת כל המועדפים של משתמש מהשרת */
  getUserFavorites(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/${userId}/favorites`);
  }

  /* סנכרון מועדפים מקומיים לשרת בעת התחברות */
  syncLocalToServer(userId: number): Observable<any[]> {
    const localFavorites = this.getLocalFavorites();
    
    if (localFavorites.length === 0) {
      return of([]);
    }

    const syncRequests = localFavorites.map(recipeId => this.addFavorite(recipeId, userId));
    
    return forkJoin(syncRequests).pipe(
      tap(() => this.saveLocalFavorites([]))
    );
  }

  /* Toggle חכם - מקומי לאורח, שרת למשתמש מחובר */
  toggleFavorite(recipeId: number, userId?: number): Observable<any> | void {
    if (!userId) {
      this.toggleLocalFavorite(recipeId);
      return;
    }

    return this.isLocalFavorite(recipeId)
      ? this.removeFavorite(recipeId, userId)
      : this.addFavorite(recipeId, userId);
  }
}