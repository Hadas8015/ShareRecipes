// קומפוננטת פרופיל - ניהול מועדפים, המתכונים שלי, יצירה/עריכת מתכון ובקשת הרשאות

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { RecipeService } from '../../services/recipe.service';
import { FavoritesService } from '../../services/favorites.service';

interface Step {
  text: string;
  ingredientsUsed: string[];
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  currentUser: any = null;
  
  activeSection: string = 'favorites';
  favoriteRecipes: any[] = [];
  editingRecipeId: number | null = null;
  loadingFavorites: boolean = false;
  loadingMyRecipes: boolean = false;
  myRecipes: any[] = [];

  showUploadForm: boolean = false;
  recipeName: string = '';
  recipeType: string = 'Parve';
  recipeCategory: string = 'MainDish';
  preparationTime: number = 30;
  
  steps: Step[] = [];
  
  ingredients: Array<{product: string, amount: string, unit: string}> = [
    {product: '', amount: '', unit: 'יחידות'}
  ];
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  
  uploadMessage: string = '';
  uploadError: string = '';
  requestMessage: string = '';
  requestMessageText: string = '';
  
  isEditingBio: boolean = false;
  tempBio: string = '';
  
  showApprovalBanner: boolean = false;
  
  typeOptions = [
    { value: 'Dairy', label: '🥛 חלבי' },
    { value: 'Meat', label: '🥩 בשרי' },
    { value: 'Parve', label: '🌿 פרווה' }
  ];
  
  categoryOptions = [
    { value: 'Cakes', label: 'עוגות ועוגיות' },
    { value: 'Desserts', label: 'קינוחים' },
    { value: 'Breakfast', label: 'ארוחות בוקר' },
    { value: 'MainDish', label: 'מנות עיקריות' },
    { value: 'Salads', label: 'סלטים ותוספות' },
    { value: 'Baked', label: 'מאפים ולחמים' },
    { value: 'Fish', label: 'דגים' },
    { value: 'FastFood', label: 'מזון מהיר' },
    { value: 'Soups', label: 'מרקים' }
  ];
  
  unitOptions = ['יחידות', 'גרם', 'כפות', 'כפיות', 'כוסות', 'מ"ל', 'ק"ג'];

  private roleLabels: { [key: string]: string } = {
    'Reader': 'משתמש רגיל',
    'Uploader': 'משתמש תוכן',
    'Admin': 'מנהל'
  };

  constructor(
    private userService: UserService,
    private recipeService: RecipeService,
    private favoritesService: FavoritesService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      this.router.navigate(['/login']);
      return;
    }
    
    this.currentUser = JSON.parse(userStr);
    this.tempBio = this.currentUser.bio ?? '';
    this.steps = [{ text: '', ingredientsUsed: [] }];
    
    /* בדיקה אם הגענו ממצב עריכת מתכון */
    const editingRecipeStr = localStorage.getItem('editingRecipe');
    if (editingRecipeStr) {
      this.loadRecipeForEditing(JSON.parse(editingRecipeStr));
      localStorage.removeItem('editingRecipe');
    }
    
    this.checkUserStatus();
    this.loadFavorites();
  }

  /* ============ ניהול שלבי הכנה ============ */

  addStep(): void {
    this.steps.push({ text: '', ingredientsUsed: [] });
    this.cdr.detectChanges();
  }

  removeStep(index: number): void {
    if (this.steps.length > 1) {
      this.steps.splice(index, 1);
      this.cdr.detectChanges();
    }
  }

  /* זיהוי אוטומטי של רכיבים בתוך טקסט השלב */
  detectIngredients(stepText: string): string[] {
    return this.ingredients
      .filter(ing => ing.product && stepText.includes(ing.product))
      .map(ing => ing.product);
  }

  onStepTextChange(index: number): void {
    this.steps[index].ingredientsUsed = this.detectIngredients(this.steps[index].text);
    this.cdr.detectChanges();
  }

  /* ============ טעינת מתכון לעריכה ============ */

  loadRecipeForEditing(recipe: any): void {
    this.activeSection = 'create';
    
    this.recipeName = recipe.name ?? '';
    this.recipeCategory = recipe.category ?? 'MainDish';
    this.recipeType = recipe.type ?? 'Parve';
    this.preparationTime = recipe.preparation_time ?? 30;
    
    if (recipe.steps?.length > 0) {
      this.steps = recipe.steps.map((step: any) => ({
        text: step.text ?? '',
        ingredientsUsed: step.ingredientsUsed ?? []
      }));
    } else if (recipe.instructions) {
      this.steps = [{ text: recipe.instructions, ingredientsUsed: [] }];
    } else {
      this.steps = [{ text: '', ingredientsUsed: [] }];
    }
    
    this.ingredients = recipe.ingredients?.length > 0
      ? recipe.ingredients.map((ing: any) => ({
          product: ing.product ?? '',
          amount: ing.amount ?? '',
          unit: ing.unit ?? 'יחידות'
        }))
      : [{product: '', amount: '', unit: 'יחידות'}];
    
    if (recipe.image_path) {
      this.imagePreview = 'http://127.0.0.1:5000/' + recipe.image_path;
    }
    
    this.editingRecipeId = recipe.id;
    this.cdr.detectChanges();
  }

  /* ============ בדיקת סטטוס משתמש ============ */

  /* עדכון נתוני המשתמש מהשרת + הצגת באנר אישור אם הפך ל-Uploader */
  checkUserStatus(): void {
    this.userService.getUserById(this.currentUser.id).subscribe({
      next: (response: any) => {
        const wasReader = this.currentUser?.role === 'Reader';
        const savedBio = this.currentUser.bio;
        
        this.currentUser = response;
        
        if (!response.bio && savedBio) {
          this.currentUser.bio = savedBio;
        }
        
        this.tempBio = this.currentUser.bio ?? '';
        
        const isNowApprovedUploader = response.role === 'Uploader' && response.is_approved_uploader;
        const hasSeenKey = `hasSeenApprovalMessage_${this.currentUser.id}`;
        const hasSeenMessage = localStorage.getItem(hasSeenKey) === 'true';
        
        if (wasReader && isNowApprovedUploader && !hasSeenMessage) {
          this.showApprovalBanner = true;
          localStorage.setItem(hasSeenKey, 'true');
          
          setTimeout(() => {
            this.showApprovalBanner = false;
            this.cdr.detectChanges();
          }, 8000);
        }
        
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        this.cdr.detectChanges();
      },
      error: (err) => console.error('שגיאה בקבלת סטטוס המשתמש:', err)
    });
  }

  /* ============ עריכת ביוגרפיה ============ */

  startEditingBio(): void {
    this.isEditingBio = true;
  }

  cancelEditingBio(): void {
    this.isEditingBio = false;
    this.tempBio = this.currentUser.bio ?? '';
  }

  saveBio(): void {
    if (!this.tempBio.trim()) {
      alert('אנא כתוב משהו בתיאור');
      return;
    }

    this.userService.updateBio(this.currentUser.id, this.tempBio).subscribe({
      next: () => {
        this.currentUser.bio = this.tempBio;
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        this.isEditingBio = false;
        alert('התיאור עודכן בהצלחה!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('שגיאה בעדכון bio:', err);
        alert('שגיאה בעדכון התיאור');
      }
    });
  }

  /* ============ ניהול רכיבים ============ */

  addIngredient(): void {
    this.ingredients.push({product: '', amount: '', unit: 'יחידות'});
  }

  removeIngredient(index: number): void {
    if (this.ingredients.length > 1) {
      this.ingredients.splice(index, 1);
    }
  }

  /* ============ העלאת תמונה ============ */

  onImageSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    
    this.selectedImage = file;
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagePreview = e.target.result;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  /* ============ ולידציה ובניית FormData ============ */

  validateUploadForm(): boolean {
    if (!this.recipeName.trim()) {
      this.uploadError = 'אנא הזן שם למתכון';
      return false;
    }
    
    if (!this.selectedImage && !this.editingRecipeId && !this.imagePreview) {
      this.uploadError = 'אנא בחר תמונה למתכון';
      return false;
    }
    
    const validSteps = this.steps.filter(step => step.text.trim());
    if (validSteps.length === 0) {
      this.uploadError = 'אנא הזן לפחות שלב הכנה אחד';
      return false;
    }
    
    const validIngredients = this.getValidIngredients();
    if (validIngredients.length === 0) {
      this.uploadError = 'אנא הוסף לפחות רכיב אחד';
      return false;
    }
    
    return true;
  }

  private getValidIngredients(): Array<{product: string, amount: string, unit: string}> {
    return this.ingredients.filter(ing => ing.product.trim() && ing.amount.trim());
  }

  private getValidSteps(): Step[] {
    return this.steps.filter(step => step.text.trim());
  }

  private buildRecipeFormData(): FormData {
    const formData = new FormData();
    formData.append('name', this.recipeName);
    formData.append('type', this.recipeType);
    formData.append('category', this.recipeCategory);
    formData.append('preparation_time', this.preparationTime.toString());
    formData.append('steps', JSON.stringify(this.getValidSteps()));
    formData.append('ingredients', JSON.stringify(this.getValidIngredients()));
    formData.append('user_id', this.currentUser.id.toString());
    
    if (this.selectedImage) {
      formData.append('image', this.selectedImage);
    }
    
    return formData;
  }

  /* ============ יצירה ועדכון מתכון ============ */

  uploadRecipe(): void {
    this.uploadMessage = '';
    this.uploadError = '';
    
    if (!this.validateUploadForm()) {
      this.cdr.detectChanges();
      return;
    }
    
    const formData = this.buildRecipeFormData();
    formData.append('user_id', this.currentUser.id.toString());
    
    this.recipeService.createRecipe(formData).subscribe({
      next: () => {
        this.uploadMessage = '✅ המתכון הועלה בהצלחה!';
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.resetUploadForm();
          this.changeSection('my-recipes');
        }, 2000);
      },
      error: (err) => {
        console.error('שגיאה בהעלאת המתכון:', err);
        this.uploadError = err.error?.error ?? err.error?.message ?? 'אירעה שגיאה בהעלאת המתכון';
        this.cdr.detectChanges();
      }
    });
  }

  updateRecipe(): void {
    this.uploadMessage = '';
    this.uploadError = '';
    
    if (!this.validateUploadForm()) {
      this.cdr.detectChanges();
      return;
    }
    
    const formData = this.buildRecipeFormData();
    
    this.recipeService.updateRecipe(this.editingRecipeId!, formData).subscribe({
      next: () => {
        this.uploadMessage = '✅ המתכון עודכן בהצלחה!';
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.resetUploadForm();
          this.loadMyRecipes();
        }, 2000);
      },
      error: (err) => {
        console.error('שגיאה בעדכון המתכון:', err);
        this.uploadError = err.error?.error ?? err.error?.message ?? 'אירעה שגיאה בעדכון המתכון';
        this.cdr.detectChanges();
      }
    });
  }

  resetUploadForm(): void {
    this.recipeName = '';
    this.recipeType = 'Parve';
    this.recipeCategory = 'MainDish';
    this.preparationTime = 30;
    this.steps = [{ text: '', ingredientsUsed: [] }];
    this.ingredients = [{product: '', amount: '', unit: 'יחידות'}];
    this.selectedImage = null;
    this.imagePreview = null;
    this.uploadMessage = '';
    this.uploadError = '';
    this.showUploadForm = false;
    this.editingRecipeId = null;
    this.cdr.detectChanges();
  }

  /* ============ בקשת הרשאות העלאה ============ */

  requestUploadPermission(): void {
    this.requestMessage = '';
    
    if (this.currentUser?.was_rejected) {
      this.showTemporaryMessage('requestMessage', '❌ בקשתך נדחתה - לא ניתן לשלוח בקשה נוספת', 5000);
      return;
    }
    
    if (!this.requestMessageText.trim()) {
      this.requestMessage = '❌ אנא כתוב הודעה למנהל';
      this.cdr.detectChanges();
      return;
    }
    
    if (this.requestMessageText.length > 500) {
      this.requestMessage = '❌ ההודעה ארוכה מדי (מקסימום 500 תווים)';
      this.cdr.detectChanges();
      return;
    }
    
    this.userService.requestUploaderStatus(this.currentUser.id, this.requestMessageText).subscribe({
      next: () => {
        this.requestMessage = '✅ הבקשה נשלחה בהצלחה! המתן לאישור המנהל';
        
        this.currentUser.role = 'Uploader';
        this.currentUser.is_approved_uploader = false;
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        
        this.requestMessageText = '';
        
        setTimeout(() => this.changeSection('favorites'), 2000);
        
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('שגיאה בשליחת הבקשה:', err);
        this.requestMessage = '❌ אירעה שגיאה בשליחת הבקשה';
        this.cdr.detectChanges();
      }
    });
  }

  private showTemporaryMessage(field: 'requestMessage' | 'uploadMessage', message: string, duration: number): void {
    (this as any)[field] = message;
    this.cdr.detectChanges();
    
    setTimeout(() => {
      (this as any)[field] = '';
      this.cdr.detectChanges();
    }, duration);
  }

  openRequestPermissionForm(): void {
    this.activeSection = 'request-permission';
    this.requestMessageText = '';
    this.requestMessage = '';
    
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }

  /* ============ בדיקות הרשאות ============ */

  canUpload(): boolean {
    return this.currentUser?.role === 'Admin' || 
           (this.currentUser?.role === 'Uploader' && this.currentUser?.is_approved_uploader);
  }

  hasRequestedPermission(): boolean {
    return this.currentUser?.role === 'Uploader' && !this.currentUser?.is_approved_uploader;
  }

  canRequestPermission(): boolean {
    return this.currentUser?.role === 'Reader';
  }

  isReader(): boolean {
    return this.currentUser?.role === 'Reader';
  }

  logout(): void {
    this.userService.logout();
    this.router.navigate(['/login']);
  }

  getRoleLabel(): string {
    const role = this.currentUser?.role;
    
    if (role === 'Uploader' && !this.currentUser?.is_approved_uploader) {
      return 'משתמש רגיל (ממתין לאישור)';
    }
    
    return this.roleLabels[role] ?? 'משתמש';
  }

  /* ============ טעינת מועדפים ============ */

loadFavorites(): void {
  this.loadingFavorites = true;
  this.favoritesService.getUserFavorites(this.currentUser.id).subscribe({
    next: (favorites) => {
      this.favoriteRecipes = favorites;
      this.loadingFavorites = false;
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('שגיאה בטעינת מועדפים:', err);
      this.loadingFavorites = false;
      this.cdr.detectChanges();
    }
  });
}

  removeFavorite(recipeId: number): void {
    if (!confirm('האם אתה בטוח שברצונך להסיר את המתכון מהמועדפים?')) return;

    this.favoritesService.removeFavorite(recipeId, this.currentUser.id).subscribe({
      next: () => {
        this.favoriteRecipes = this.favoriteRecipes.filter(recipe => recipe.id !== recipeId);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('שגיאה בהסרת מועדף:', err);
        alert('אירעה שגיאה בהסרת המתכון מהמועדפים');
      }
    });
  }

  /* ============ טעינת המתכונים שלי ============ */

loadMyRecipes(): void {
  this.loadingMyRecipes = true;
  this.recipeService.getUserRecipes(this.currentUser.id).subscribe({
    next: (recipes) => {
      this.myRecipes = recipes;
      this.loadingMyRecipes = false;
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('שגיאה בטעינת מתכונים:', err);
      this.loadingMyRecipes = false;
      this.cdr.detectChanges();
    }
  });
}

  /* ============ ניווט ============ */

  goToRecipe(recipeId: number): void {
    this.router.navigate(['/recipe', recipeId]);
  }

  editRecipeInline(recipe: any): void {
    this.recipeService.getRecipeById(recipe.id).subscribe({
      next: (fullRecipe) => this.loadRecipeForEditing(fullRecipe),
      error: () => this.loadRecipeForEditing(recipe)
    });
  }

  changeSection(section: string): void {
    this.activeSection = section;
    
    if (section === 'favorites') {
      this.loadFavorites();
    } else if (section === 'my-recipes') {
      this.loadMyRecipes();
    }
    
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }

  startCreateNewRecipe(): void {
    this.resetUploadForm();
    this.activeSection = 'create';
    
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }

  /* רכיבים שלא הוזכרו בשלבים - תזכורת למשתמש */
  getUnusedIngredients(): string[] {
    const allIngredients = this.ingredients
      .filter(ing => ing.product.trim())
      .map(ing => ing.product);
    
    const usedIngredients = new Set<string>();
    for (const step of this.steps) {
      for (const ing of step.ingredientsUsed) {
        usedIngredients.add(ing);
      }
    }
    
    return allIngredients.filter(ing => !usedIngredients.has(ing));
  }

  getStarsArray(rating: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < Math.round(rating));
  }
}