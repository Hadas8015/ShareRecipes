// קומפוננטת מתכונים - תצוגת גריד עם סינון, מיון וחיפוש חכם לפי רכיבים

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../../services/recipe.service';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './recipes.component.html',
  styleUrl: './recipes.component.css'
})
export class RecipesComponent implements OnInit {
  recipes: any[] = [];
  allRecipes: any[] = [];
  currentUser: any = null;

  selectedCategory: string = '';
  selectedCategoryHebrew: string = '';

  isPanelOpen: boolean = false;

  /* משתני סינון */
  selectedType: string = '';
  selectedTypeHebrew: string = 'הכל';
  minTime: number = 0;
  maxTime: number = 180;
  timeRange = { min: 0, max: 180 };
  selectedRating: number = 0;
  isRatingExpanded: boolean = false;

  sortBy: string = '';

  /* משתני חיפוש חכם */
  searchIngredients: string[] = [];
  newIngredient: string = '';
  isSmartSearchActive: boolean = false;

  searchQuery: string = '';

  /* מיפוי קטגוריות אנגלית-עברית */
  private categoryMapping: { [key: string]: string } = {
    'Cakes': 'עוגות ועוגיות',
    'Desserts': 'קינוחים',
    'Breakfast': 'ארוחות בוקר',
    'MainDish': 'מנות עיקריות',
    'Salads': 'סלטים ותוספות',
    'Baked': 'מאפים ולחמים',
    'Fish': 'דגים',
    'FastFood': 'מזון מהיר',
    'Soups': 'מרקים'
  };

  /* מיפוי סוגי כשרות */
  private typeMapping: { [key: string]: string } = {
    'Meat': 'בשרי',
    'Dairy': 'חלבי',
    'Parve': 'פרווה'
  };

  private hebrewToTypeMapping: { [key: string]: string } = {
    'הכל': '',
    'בשרי': 'Meat',
    'חלבי': 'Dairy',
    'פרווה': 'Parve'
  };

  constructor(
    private recipeService: RecipeService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    window.scrollTo(0, 0);
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }

    this.selectedCategory = this.route.snapshot.paramMap.get('category') ?? '';
    this.selectedCategoryHebrew = this.categoryMapping[this.selectedCategory] ?? '';

    if (this.selectedCategory) {
      this.loadRecipesByCategory(this.selectedCategory);
    }
  }

  backToCategories(): void {
    this.router.navigate(['/categories']);
  }

  /* טעינת מתכונים לפי קטגוריה */
  loadRecipesByCategory(category: string): void {
    this.recipeService.getRecipesWithParams({ category }).subscribe({
      next: (res) => this.handleRecipesLoaded(res),
      error: (err) => console.error('שגיאה:', err)
    });
  }

  loadRecipes(): void {
    this.recipeService.getAllRecipes().subscribe({
      next: (res) => this.handleRecipesLoaded(res),
      error: (err) => console.error('שגיאה:', err)
    });
  }

  /* עיבוד תוצאות וחישוב טווח זמנים */
  private handleRecipesLoaded(res: any[]): void {
    this.allRecipes = res;
    this.recipes = res;
    if (res.length > 0) {
      const times = res.map((r: any) => r.preparation_time);
      this.timeRange.max = Math.max(...times);
      this.maxTime = this.timeRange.max;
    }
    this.cdr.detectChanges();
  }

  /* מחיקת מתכון - Admin בלבד */
  deleteRecipe(event: Event, recipeId: number, recipeName: string): void {
    event.stopPropagation();

    if (!this.currentUser || this.currentUser.role !== 'Admin') {
      alert('רק מנהל יכול למחוק מתכונים');
      return;
    }

    if (!confirm(`האם אתה בטוח שברצונך למחוק את המתכון "${recipeName}"?\n\nמחיקה זו תסיר גם את כל התמונות, הדירוגים והתגובות הקשורות למתכון.`)) {
      return;
    }

    this.recipeService.deleteRecipe(recipeId, this.currentUser.id).subscribe({
      next: () => {
        this.recipes = this.recipes.filter(r => r.id !== recipeId);
        this.allRecipes = this.allRecipes.filter(r => r.id !== recipeId);
        alert('✅ המתכון נמחק בהצלחה!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('שגיאה במחיקת מתכון:', err);
        alert(`❌ שגיאה במחיקת מתכון: ${err.error?.message ?? err.message}`);
      }
    });
  }

  /* פתיחה/סגירה של פאנל הסינון */
  togglePanel(): void {
    this.isPanelOpen = !this.isPanelOpen;
  }

  closePanel(): void {
    this.isPanelOpen = false;
  }

  toggleRatingExpansion(): void {
    this.isRatingExpanded = !this.isRatingExpanded;
  }

  /* פונקציות סינון - כל שינוי מפעיל את applyFiltersAndSort */
  selectRating(rating: number): void {
    this.selectedRating = rating;
    this.applyFiltersAndSort();
  }

  selectType(typeHebrew: string): void {
    this.selectedTypeHebrew = typeHebrew;
    this.selectedType = this.hebrewToTypeMapping[typeHebrew] ?? '';
    this.applyFiltersAndSort();
  }

  updateTimeRange(): void {
    if (this.minTime > this.maxTime) {
      this.minTime = this.maxTime;
    }
    this.applyFiltersAndSort();
  }

  selectSort(sortType: string): void {
    this.sortBy = sortType;
    this.applyFiltersAndSort();
  }

  /* ניהול רכיבים לחיפוש חכם */
  addIngredient(): void {
    this.cdr.detectChanges();

    const trimmed = this.newIngredient.trim();
    if (trimmed && !this.searchIngredients.includes(trimmed)) {
      this.searchIngredients.push(trimmed);
      this.newIngredient = '';
    }
  }

  removeIngredient(ingredient: string): void {
    this.searchIngredients = this.searchIngredients.filter(i => i !== ingredient);
    if (this.searchIngredients.length === 0) {
      this.isSmartSearchActive = false;
      this.applyFiltersAndSort();
    }
  }

  /* חיפוש חכם - שליחת רכיבים לשרת וקבלת מתכונים עם אחוזי התאמה */
  performSmartSearch(): void {
    this.cdr.detectChanges();

    if (this.searchIngredients.length === 0) {
      alert('נא הוסף לפחות רכיב אחד לחיפוש');
      return;
    }

    this.isSmartSearchActive = true;

    this.recipeService.searchByIngredients(this.searchIngredients).subscribe({
      next: (results) => {
        this.recipes = this.selectedCategory
          ? results.filter(r => r.category === this.selectedCategory)
          : results;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('שגיאה בחיפוש חכם:', err)
    });
  }

  /* הפעלת כל הפילטרים - שליחת פרמטרים לשרת */
  applyFiltersAndSort(): void {
    this.cdr.detectChanges();

    if (this.isSmartSearchActive) return;

    const params: any = {};

    if (this.selectedCategory) params.category = this.selectedCategory;
    if (this.selectedType) params.type = this.selectedType;
    if (this.minTime > 0) params.min_time = this.minTime;
    if (this.maxTime < this.timeRange.max) params.max_time = this.maxTime;
    if (this.selectedRating > 0) params.min_rating = this.selectedRating;
    if (this.sortBy) params.sort = this.sortBy;
    if (this.searchQuery?.trim()) params.name = this.searchQuery.trim();

    this.recipeService.getRecipesWithParams(params).subscribe({
      next: (res) => {
        this.recipes = res;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('שגיאה בסינון:', err)
    });
  }

  /* איפוס כל הפילטרים */
  resetAll(): void {
    this.selectedType = '';
    this.selectedTypeHebrew = 'הכל';
    this.minTime = 0;
    this.maxTime = this.timeRange.max;
    this.selectedRating = 0;
    this.sortBy = '';
    this.searchIngredients = [];
    this.isSmartSearchActive = false;
    this.isRatingExpanded = false;
    this.searchQuery = '';

    if (this.selectedCategory) {
      this.loadRecipesByCategory(this.selectedCategory);
    }

    this.cdr.detectChanges();
  }

  getHebrewType(englishType: string): string {
    return this.typeMapping[englishType] ?? englishType;
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'Admin';
  }

  onSearchChange(): void {
    this.applyFiltersAndSort();
  }
}