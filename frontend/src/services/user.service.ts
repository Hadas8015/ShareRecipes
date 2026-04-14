// שירות ניהול משתמשים - הרשמה, התחברות, פרופיל והרשאות Admin

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  bio?: string;
  is_approved_uploader: boolean;
  was_rejected: boolean;
}

export interface AuthResponse {
  message: string;
  user: UserResponse;
}

export interface PublicProfile {
  id: number;
  name: string;
  bio: string;
  profile_image: string;
  profile_views: number;
  role: string;
  recipes: any[];
  recipe_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private baseUrl = 'http://127.0.0.1:5000';

  constructor(private http: HttpClient) { }

  // ================== Authentication Functions ==================

  /* כניסה למערכת */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, { email, password });
  }

  /* הרשמה למערכת */
  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, { name, email, password });
  }

  // ================== User Data Functions ==================

  /* קבלת פרטי משתמש לפי ID */
  getUserById(userId: number): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/user/${userId}`);
  }

  /* קבלת פרופיל ציבורי של משתמש (כולל המתכונים שלו) */
  getUserPublicProfile(userId: number, viewerId?: number | null): Observable<any> {
    let params = new HttpParams();
    
    if (viewerId != null) {
      params = params.set('viewer_id', viewerId.toString());
    }
    
    return this.http.get(`${this.baseUrl}/user/${userId}/profile`, { params });
  }


  /* עדכון ביוגרפיה של משתמש */
  updateBio(userId: number, bio: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/user/${userId}/bio`, { bio });
  }

  /* שליחת בקשה להיות מעלה תוכן */
  requestUploaderStatus(userId: number, message: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/user/${userId}/request-uploader`, { message });
  }

  // ================== User State Functions ==================

  /* בדיקה אם המשתמש מחובר */
  isLoggedIn(): boolean {
    return !!localStorage.getItem('currentUser');
  }

  /* בדיקה אם המשתמש הוא מנהל */
  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'Admin';
  }

  /* קבלת המשתמש הנוכחי מה-localStorage */
  getCurrentUser(): UserResponse | null {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /* שמירת המשתמש ב-localStorage */
  saveCurrentUser(user: UserResponse): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('token', 'logged-in');
  }

  /* התנתקות */
  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
  }

  // ================== Admin Functions ==================

  /* קבלת כל הבקשות הממתינות לאישור (Admin בלבד) */
getPendingRequests(): Observable<any[]> {
  const adminId = this.getCurrentUser()?.id;
  return this.http.get<any[]>(`${this.baseUrl}/admin/uploader-requests?user_id=${adminId}`);
}

  /* אישור משתמש כמעלה תוכן (Admin בלבד) */
approveUser(userId: number): Observable<any> {
  const adminId = this.getCurrentUser()?.id;
  return this.http.put(`${this.baseUrl}/admin/approve-uploader/${userId}?user_id=${adminId}`, {});
}

  /* דחיית בקשת משתמש (Admin בלבד) */
rejectUser(userId: number): Observable<any> {
  const adminId = this.getCurrentUser()?.id;
  return this.http.put(`${this.baseUrl}/admin/reject-uploader/${userId}?user_id=${adminId}`, {});
}
}