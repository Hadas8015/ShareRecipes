// קומפוננטת קטגוריות - תצוגת גריד של כל קטגוריות המתכונים עם ניווט

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css'
})
export class CategoriesComponent implements OnInit {
  
  /* מערך הקטגוריות - שם באנגלית (לניווט), שם בעברית (לתצוגה), ותמונה */
  categories = [
    { english: 'Breakfast', hebrew: 'ארוחות בוקר', image: 'https://i.pinimg.com/1200x/8f/49/16/8f4916b7f86ada829c8032f75e1d6344.jpg' },
    { english: 'Salads', hebrew: 'סלטים ותוספות', image: 'https://i.pinimg.com/1200x/bf/d4/f7/bfd4f7ddea1e9a0780510796ecabaf47.jpg' },
    { english: 'Fish', hebrew: 'דגים', image: 'https://i.pinimg.com/736x/b4/8e/2f/b48e2fd6dc0ac7b99f44ec03b93a19e2.jpg' },
    { english: 'MainDish', hebrew: 'מנות עיקריות', image: 'https://i.pinimg.com/1200x/7d/c3/3e/7dc33eaf44335e182b2f1cc3dbe3b8cb.jpg' },
    { english: 'Baked', hebrew: 'מאפים ולחמים', image: 'https://i.pinimg.com/736x/34/6f/b2/346fb299d03168eb484c8c73ac3a6b80.jpg' },
    { english: 'FastFood', hebrew: 'junk food', image: 'https://i.pinimg.com/736x/54/72/c5/5472c5e110ef24598a3cdefa4fcf4921.jpg' },
    { english: 'Soups', hebrew: 'מרקים', image: 'https://i.pinimg.com/736x/51/e4/99/51e49927b910ed7965911e3ac64503b1.jpg' },
    { english: 'Desserts', hebrew: 'קינוחים', image: 'https://i.pinimg.com/736x/c7/c9/01/c7c9019673af52ccbd8691c4cefdb4f3.jpg' },
    { english: 'Cakes', hebrew: 'עוגות ועוגיות', image: 'https://i.pinimg.com/736x/d5/57/50/d557503fc7b36877ebb12fb68328ba46.jpg' }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
  }

  /* ניווט לעמוד המתכונים של הקטגוריה שנבחרה */
  selectCategory(categoryEnglish: string): void {
    this.router.navigate(['/recipes', categoryEnglish]);
  }
}