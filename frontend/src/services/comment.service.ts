// שירות ניהול תגובות למתכונים - CRUD + מערכת לייקים

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// מבנה אובייקט תגובה
export interface Comment {
  id: number;
  user_id: number;
  user_name: string;
  profile_image: string;
  text: string;
  created_at: string;
  likes_count: number;
  dislikes_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private baseUrl = 'http://127.0.0.1:5000';

  constructor(private http: HttpClient) { }

  /*קבלת כל התגובות של מתכון*/
  getComments(recipeId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/recipes/${recipeId}/comments`);
  }

  /*הוספת תגובה חדשה*/
  addComment(recipeId: number, userId: number, text: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/recipes/${recipeId}/comments`, {
      user_id: userId,
      text: text
    });
  }

  /*מחיקת תגובה (למנהל או לבעל התגובה)*/
  deleteComment(commentId: number, userId: number): Observable<any> {
    // תיקון: השרת מצפה ל-user_id כ-query param ולא ב-body
    return this.http.delete(`${this.baseUrl}/comments/${commentId}?user_id=${userId}`);
  }

  /*לייק או דיסלייק לתגובה*/
  toggleLike(commentId: number, userId: number, isLike: boolean): Observable<any> {
    return this.http.post(`${this.baseUrl}/comments/${commentId}/like`, {
      user_id: userId,
      is_like: isLike
    });
  }

  /*קבלת תגובת המשתמש על תגובה מסוימת*/
  getUserReaction(commentId: number, userId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/comments/${commentId}/user-reaction/${userId}`);
  }
}