// קומפוננטת פרטי מתכון - תצוגה מלאה של מתכון כולל:
// רכיבים, שלבי הכנה, דירוג, תגובות, מועדפים ומצב שף קולי (Voice Chef Mode)

import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RecipeService } from '../../services/recipe.service';
import { FavoritesService } from '../../services/favorites.service';
import { CommentService, Comment } from '../../services/comment.service';
import { VoiceService } from '../../services/voice.service';

@Component({
  selector: 'app-recipe-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './recipe-details.component.html',
  styleUrl: './recipe-details.component.css'
})
export class RecipeDetailsComponent implements OnInit, OnDestroy {
  recipe: any = null;
  showVariations: boolean = false;
  userRating: number = 0;
  currentVariationIndex: number = 0;
  currentUser: any = null;
  checkedIngredients: Set<number> = new Set();
  isFavorite: boolean = false;

  /* משתני תגובות */
  comments: Comment[] = [];
  newCommentText: string = '';
  userReactions: Map<number, string | null> = new Map();
  
  /* משתני מצב שף קולי */
  isChefMode: boolean = false;
  chefModeScreen: 'welcome' | 'ingredients' | 'steps' = 'welcome';
  lastStepBeforeIngredients: number = 0;
  currentStepIndex: number = 0;
  completedSteps: Set<number> = new Set();
  isListening: boolean = false;
  isPaused: boolean = false;
  currentSpeechText: string = '';
  lastCharIndex: number = 0;
  recognitionSupported: boolean = false;
  lastCommand: string = '';
  steps: string[] = [];
  showCommands: boolean = false;
  enrichedStepsCache: Map<number, string> = new Map();

  /* מיפוי קטגוריות וסוגים לעברית */
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

  private typeMapping: { [key: string]: string } = {
    'Dairy': 'חלבי',
    'Meat': 'בשרי',
    'Parve': 'פרווה'
  };

  /* מיפוי מספרים סודרים בעברית (לקריאה קולית) */
  private ordinalNumbers: string[] = [
    'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי',
    'שישי', 'שביעי', 'שמיני', 'תשיעי', 'עשירי',
    'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר',
    'שישה עשר', 'שבעה עשר', 'שמונה עשר', 'תשעה עשר', 'עשרים'
  ];

  private ordinalToNumber: { [key: string]: number } = {
    'ראשון': 1, 'שני': 2, 'שלישי': 3, 'רביעי': 4, 'חמישי': 5,
    'שישי': 6, 'שביעי': 7, 'שמיני': 8, 'תשיעי': 9, 'עשירי': 10
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService,
    private favoritesService: FavoritesService,
    private commentService: CommentService,
    private voiceService: VoiceService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.recognitionSupported = this.voiceService.isRecognitionSupported();
  }

  ngOnInit(): void {
    window.scrollTo(0, 0);
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }

    const id = Number(this.route.snapshot.paramMap.get('id'));
    
    this.recipeService.getRecipeById(id).subscribe({
      next: (data: any) => {
        this.recipe = data;
        this.checkFavoriteStatus(id);
        this.loadComments();
        this.initializeSteps();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('שגיאה בטעינת המתכון:', err)
    });
  }

  ngOnDestroy(): void {
    this.exitChefMode();
  }

  /* אתחול שלבי ההכנה - תמיכה במבנה ישן (instructions) וחדש (steps) */
  private initializeSteps(): void {
    if (!this.recipe) return;

    if (this.recipe.steps && Array.isArray(this.recipe.steps)) {
      this.steps = this.recipe.steps.map((step: any) => 
        typeof step === 'string' ? step : step.text
      );
    } else if (this.recipe.instructions) {
      this.steps = typeof this.recipe.instructions === 'string'
        ? this.recipe.instructions.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0)
        : Array.isArray(this.recipe.instructions) ? this.recipe.instructions : [];
    }
  }

  // ==================== תגובות ====================
  
  loadComments(): void {
    this.commentService.getComments(this.recipe.id).subscribe({
      next: (comments) => {
        this.comments = comments;
        
        if (this.currentUser) {
          comments.forEach(comment => this.loadUserReaction(comment.id));
        }
        
        this.cdr.detectChanges();
      },
      error: (err) => console.error('שגיאה בטעינת תגובות:', err)
    });
  }

  loadUserReaction(commentId: number): void {
    if (!this.currentUser) return;
    
    this.commentService.getUserReaction(commentId, this.currentUser.id).subscribe({
      next: (response) => {
        this.userReactions.set(commentId, response.user_reaction);
        this.cdr.detectChanges();
      }
    });
  }

  addComment(): void {
    if (!this.currentUser) {
      alert('עליך להתחבר כדי להוסיף תגובה');
      return;
    }

    const text = this.newCommentText.trim();
    if (!text) {
      alert('אנא כתוב תגובה');
      return;
    }

    if (text.length > 500) {
      alert('התגובה ארוכה מדי (מקסימום 500 תווים)');
      return;
    }

    this.commentService.addComment(this.recipe.id, this.currentUser.id, text).subscribe({
      next: (response) => {
        this.comments.unshift(response.comment);
        this.newCommentText = '';
        this.cdr.detectChanges();
      },
      error: (err) => alert(`שגיאה בהוספת תגובה: ${err.error?.error ?? err.message}`)
    });
  }

  deleteComment(commentId: number): void {
    if (!confirm('האם אתה בטוח שברצונך למחוק תגובה זו?')) return;

    this.commentService.deleteComment(commentId, this.currentUser.id).subscribe({
      next: () => {
        this.comments = this.comments.filter(c => c.id !== commentId);
        this.cdr.detectChanges();
      },
      error: (err) => alert(`שגיאה במחיקת תגובה: ${err.error?.error ?? err.message}`)
    });
  }

  toggleLike(commentId: number, isLike: boolean): void {
    if (!this.currentUser) {
      alert('עליך להתחבר כדי לתת לייק/דיסלייק');
      return;
    }

    this.commentService.toggleLike(commentId, this.currentUser.id, isLike).subscribe({
      next: (response) => {
        const comment = this.comments.find(c => c.id === commentId);
        if (comment) {
          comment.likes_count = response.likes_count;
          comment.dislikes_count = response.dislikes_count;
        }
        this.userReactions.set(commentId, response.user_reaction);
        this.cdr.detectChanges();
      },
      error: (err) => alert(`שגיאה: ${err.error?.error ?? err.message}`)
    });
  }

  isMyComment(comment: Comment): boolean {
    return this.currentUser && comment.user_id === this.currentUser.id;
  }

  hasUserReaction(commentId: number, reactionType: 'like' | 'dislike'): boolean {
    return this.userReactions.get(commentId) === reactionType;
  }

  /* פורמט תאריך יחסי (לפני X דקות/שעות/ימים) */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 10) return 'הרגע';
    if (diffMins === 1 || diffSecs < 60) return 'לפני דקה';
    if (diffMins < 60) return `לפני ${diffMins} דקות`;
    if (diffHours === 1) return 'לפני שעה';
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    if (diffDays === 1) return 'אתמול';
    if (diffDays < 7) return `לפני ${diffDays} ימים`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? 'לפני שבוע' : `לפני ${weeks} שבועות`;
    }
    
    return date.toLocaleDateString('he-IL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ==================== מועדפים ====================

  checkFavoriteStatus(recipeId: number): void {
    if (this.currentUser) {
      this.favoritesService.checkIfFavorite(recipeId, this.currentUser.id).subscribe({
        next: (response: any) => {
          this.isFavorite = response.is_favorite;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.isFavorite = false;
    }
  }

  toggleFavorite(): void {
    const userId = this.currentUser?.id;
    
    if (!userId) {
      // משתמש לא מחובר - לא יכול להוסיף למועדפים
      this.router.navigate(['/login']);
      return;
    }

    const action$ = this.isFavorite
      ? this.favoritesService.removeFavorite(this.recipe.id, userId)
      : this.favoritesService.addFavorite(this.recipe.id, userId);

    action$.subscribe({
      next: () => {
        this.isFavorite = !this.isFavorite;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('שגיאה בעדכון מועדפים:', err)
    });
  }

  // ==================== ניווט ====================

  backToCategory(): void {
    const route = this.recipe?.category 
      ? ['/recipes', this.recipe.category] 
      : ['/categories'];
    this.router.navigate(route);
  }

  goToUploaderProfile(): void {
    if (this.recipe?.uploader?.id) {
      this.router.navigate(['/public-profile', this.recipe.uploader.id]);
    }
  }

  // ==================== וריאציות ====================

  toggleVariations(): void {
    if (this.recipe?.variation_paths?.length > 0) {
      this.showVariations = !this.showVariations;
      this.currentVariationIndex = 0;
    } else {
      alert('אין וריאציות זמינות למתכון זה');
    }
  }

  nextVariation(event: Event): void {
    event.stopPropagation();
    this.currentVariationIndex = this.currentVariationIndex < this.recipe.variation_paths.length - 1
      ? this.currentVariationIndex + 1
      : 0;
  }

  prevVariation(event: Event): void {
    event.stopPropagation();
    this.currentVariationIndex = this.currentVariationIndex > 0
      ? this.currentVariationIndex - 1
      : this.recipe.variation_paths.length - 1;
  }

  // ==================== דירוג ====================

  submitRating(): void {
    if (this.userRating === 0) {
      alert('אנא בחר דירוג לפני השליחה');
      return;
    }

    if (!this.currentUser) {
      alert('עליך להתחבר כדי לדרג');
      return;
    }

    this.recipeService.rateRecipe(this.recipe.id, this.userRating, this.currentUser.id).subscribe({
      next: (response: any) => {
        this.recipe.rating = response.new_average;
        this.userRating = 0;
        this.recipe.rating_count = response.total_ratings;
        alert(`✅ תודה על הדירוג!\n\nדירוג ממוצע חדש: ${response.new_average} ⭐\nמספר דירוגים: ${response.total_ratings}`);
        this.cdr.detectChanges();
      },
      error: (err) => alert(`שגיאה בשמירת הדירוג: ${err.error?.message ?? err.message}`)
    });
  }

  selectRating(stars: number, isHalf: boolean = false): void {
    this.userRating = isHalf ? stars - 0.5 : stars;
  }

  isFullStar(position: number): boolean {
    return this.userRating >= position;
  }

  isHalfStar(position: number): boolean {
    return this.userRating >= (position - 0.5) && this.userRating < position;
  }

  getAverageStars(): number {
    return this.recipe?.rating ?? 0;
  }

  getCategoryHebrew(): string {
    return this.categoryMapping[this.recipe?.category] ?? '';
  }

getTypeHebrew(type: string): string {
  const mapping: { [key: string]: string } = {
    'Meat': 'בשרי',
    'Dairy': 'חלבי',
    'Parve': 'פרווה'
  };
  return mapping[type] || type;
}

  // ==================== רכיבים ====================

  toggleIngredient(index: number): void {
    if (this.checkedIngredients.has(index)) {
      this.checkedIngredients.delete(index);
    } else {
      this.checkedIngredients.add(index);
    }
  }

  isIngredientChecked(index: number): boolean {
    return this.checkedIngredients.has(index);
  }

  // ==================== שיתוף ====================

  getEmailShareLink(): string {
    if (!this.recipe) return '#';
    
    const subject = encodeURIComponent(`מתכון מדהים: ${this.recipe.name}`);
    const body = encodeURIComponent(
      `היי! מצאתי מתכון מעולה ורציתי לשתף אותך:\n\n` +
      `${this.recipe.name}\n` +
      `זמן הכנה: ${this.recipe.preparation_time} דקות\n\n` +
      `לינק למתכון: ${window.location.href}\n\n` +
      `בתאבון! 🍽️`
    );
    
    return `mailto:?subject=${subject}&body=${body}`;
  }

  // ==================== מחיקה (Admin) ====================

  deleteRecipe(): void {
    if (!this.currentUser || this.currentUser.role !== 'Admin') {
      alert('רק מנהל יכול למחוק מתכונים');
      return;
    }

    if (!confirm(`האם אתה בטוח שברצונך למחוק את המתכון "${this.recipe.name}"?\n\nמחיקה זו תסיר גם את כל התמונות, הדירוגים והתגובות הקשורות למתכון.`)) {
      return;
    }

    this.recipeService.deleteRecipe(this.recipe.id, this.currentUser.id).subscribe({
      next: () => {
        alert('✅ המתכון נמחק בהצלחה!');
        this.router.navigate(['/recipes']);
      },
      error: (err) => {
        console.error('שגיאה במחיקת מתכון:', err);
        alert(`❌ שגיאה במחיקת מתכון: ${err.error?.message ?? err.message}`);
      }
    });
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'Admin';
  }

  // ==================== Voice Chef Mode ====================

  enterChefMode(): void {
    if (!this.steps || this.steps.length === 0) {
      this.initializeSteps();
    }

    if (!this.steps || this.steps.length === 0) {
      alert('אין שלבי הכנה במתכון זה');
      return;
    }

    this.isChefMode = true;
    this.chefModeScreen = 'welcome';
    this.currentStepIndex = 0;
    this.completedSteps.clear();
    this.enrichedStepsCache.clear();
    
    this.startVoiceRecognition();
  }

  exitChefMode(): void {
    this.isChefMode = false;
    this.voiceService.stopSpeaking();
    this.voiceService.stopListening();
    this.isListening = false;
    this.cdr.detectChanges();
  }

  startVoiceRecognition(): void {
    if (!this.recognitionSupported) return;

    this.isListening = true;
    this.voiceService.startListening(
      (text: string) => this.handleVoiceCommand(text),
      () => {
        this.isListening = false;
        this.cdr.detectChanges();
      }
    );
  }

  /* עיבוד פקודות קוליות */
  handleVoiceCommand(text: string): void {
    this.ngZone.run(() => {
      this.lastCommand = text;
      this.cdr.detectChanges();

      const lowerText = text.toLowerCase().trim();

      /* פקודות גלובליות */
      if (lowerText.includes('עצור') || lowerText.includes('עצרו')) {
        this.pauseSpeech();
        return;
      }

      if (lowerText.includes('המשך') || lowerText.includes('המשיכו') || lowerText.includes('תמשיך')) {
        this.resumeSpeech();
        return;
      }

      if (lowerText.includes('סגור') || lowerText.includes('סגירה') || lowerText.includes('יציאה')) {
        this.exitChefMode();
        return;
      }

      this.handleScreenSpecificCommand(lowerText);
    });
  }

  /* פקודות לפי מסך נוכחי */
  private handleScreenSpecificCommand(lowerText: string): void {
    switch (this.chefModeScreen) {
      case 'welcome':
        if (lowerText.includes('התחל') || lowerText.includes('תתחיל') || lowerText.includes('שלב ראשון')) {
          this.startFirstStep();
        } else if (lowerText.includes('רכיבים')) {
          this.showIngredientsScreen();
        }
        break;

      case 'ingredients':
        if (lowerText.includes('חזור') || lowerText.includes('התחל') || lowerText.includes('שלב')) {
          this.returnToLastStep();
        }
        break;

      case 'steps':
        this.handleStepsCommand(lowerText);
        break;
    }
  }

  /* פקודות במסך השלבים */
  private handleStepsCommand(lowerText: string): void {
    if (lowerText.includes('הבא') || lowerText.includes('שלב הבא')) {
      this.nextStep();
      return;
    }

    if (lowerText.includes('קודם') || lowerText.includes('שלב קודם') || lowerText.includes('לפני')) {
      this.previousStep();
      return;
    }

    if (lowerText.includes('שוב') || lowerText.includes('חזור על השלב')) {
      this.repeatStep();
      return;
    }

    if (lowerText.includes('רכיבים')) {
      this.showIngredientsScreen();
      return;
    }

    /* מעבר לשלב ספציפי לפי מספר */
    const stepMatch = lowerText.match(/שלב\s*(\d+|ראשון|שני|שלישי|רביעי|חמישי|שישי|שביעי|שמיני|תשיעי|עשירי)/);
    if (stepMatch) {
      const stepNumber = this.ordinalToNumber[stepMatch[1]] ?? parseInt(stepMatch[1]);

      if (stepNumber >= 1 && stepNumber <= this.steps.length) {
        this.currentStepIndex = stepNumber - 1;
        this.cdr.detectChanges();
        this.speakCurrentStep();
      }
    }
  }

  pauseSpeech(): void {
    if (!this.voiceService.isSpeaking()) return;

    this.lastCharIndex = this.voiceService.currentCharIndex;
    this.currentSpeechText = this.voiceService.currentText;
    this.voiceService.stopSpeaking();
    this.isPaused = true;
    this.cdr.detectChanges();
  }

  resumeSpeech(): void {
    this.isPaused = false;
    
    if (this.currentSpeechText && this.lastCharIndex > 0) {
      this.voiceService.speak(this.currentSpeechText, undefined, this.lastCharIndex);
    } else {
      if (this.chefModeScreen === 'steps') {
        this.speakCurrentStep();
      } else if (this.chefModeScreen === 'ingredients') {
        this.speakIngredients();
      }
    }
    
    this.cdr.detectChanges();
  }

  speakCurrentStep(): void {
    if (!this.steps?.[this.currentStepIndex]) return;

    const textToSpeak = `שלב ${this.getOrdinalNumber(this.currentStepIndex + 1)}. ${this.getEnrichedStep(this.currentStepIndex)}`;
    this.voiceService.speak(textToSpeak);
  }

  /* העשרת שלב עם כמויות הרכיבים */
  enrichStepWithQuantities(stepText: string): string {
    if (!stepText?.trim() || !this.recipe?.ingredients?.length) {
      return stepText;
    }

    let enrichedText = stepText;

    this.recipe.ingredients.forEach((ingredient: any) => {
      const productName = ingredient.product.trim();
      
      if (!enrichedText.toLowerCase().includes(productName.toLowerCase())) {
        return;
      }
      
      const quantity = `${ingredient.amount} ${ingredient.unit}`;
      const regexWithHe = new RegExp(`(^|\\s)(ה?)(${productName})(?=\\s|$|,|\\.)`, 'gi');
      
      enrichedText = enrichedText.replace(regexWithHe, (fullMatch, spaceBefore, hePrefix, productMatch, offset) => {
        const textBefore = enrichedText.substring(Math.max(0, offset - 20), offset);
        const hasNumberBefore = /\d+\s*(כוס|גרם|כף|מ"ל|ליטר|יח')?\s*$/.test(textBefore);
        
        return hasNumberBefore ? fullMatch : `${spaceBefore}${quantity} ${hePrefix}${productMatch}`;
      });
    });

    return enrichedText;
  }

  getEnrichedStep(index: number): string {
    if (!this.steps?.[index]) return '';
    
    if (this.enrichedStepsCache.has(index)) {
      return this.enrichedStepsCache.get(index)!;
    }
    
    const enriched = this.enrichStepWithQuantities(this.steps[index]);
    this.enrichedStepsCache.set(index, enriched);
    return enriched;
  }

  getOrdinalNumber(num: number): string {
    return (num >= 1 && num <= this.ordinalNumbers.length) 
      ? this.ordinalNumbers[num - 1] 
      : num.toString();
  }

  toggleCommands(): void {
    this.showCommands = !this.showCommands;
  }

  nextStep(): void {
    if (!this.steps) return;

    this.completedSteps.add(this.currentStepIndex);

    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this.cdr.detectChanges();
      this.speakCurrentStep();
    } else {
      this.voiceService.speak('כל הכבוד! סיימת את כל שלבי המתכון.', () => {
        setTimeout(() => this.exitChefMode(), 2000);
      });
    }
  }

  previousStep(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.cdr.detectChanges();
      this.speakCurrentStep();
    } else {
      this.voiceService.speak('זה השלב הראשון');
    }
  }

  repeatStep(): void {
    this.speakCurrentStep();
  }

  speakIngredients(): void {
    if (!this.recipe?.ingredients?.length) {
      this.voiceService.speak('אין רכיבים במתכון זה');
      return;
    }

    const ingredientsList = this.recipe.ingredients
      .map((ing: any) => `${ing.amount} ${ing.unit} ${ing.product}`)
      .join(', ');

    this.voiceService.speak(`רשימת הרכיבים: ${ingredientsList}`);
  }

  startFirstStep(): void {
    if (!this.steps?.length) {
      this.voiceService.speak('אין שלבי הכנה במתכון זה');
      return;
    }

    this.chefModeScreen = 'steps';
    this.currentStepIndex = 0;
    
    /* חישוב מראש של כל השלבים המועשרים */
    if (this.enrichedStepsCache.size === 0) {
      for (let i = 0; i < this.steps.length; i++) {
        this.getEnrichedStep(i);
      }
    }
    
    setTimeout(() => {
      this.cdr.detectChanges();
      this.speakCurrentStep();
    }, 0);
  }

  showIngredientsScreen(): void {
    if (this.chefModeScreen === 'steps') {
      this.lastStepBeforeIngredients = this.currentStepIndex;
    }
    
    this.chefModeScreen = 'ingredients';
    
    setTimeout(() => this.cdr.detectChanges(), 0);
    
    this.speakIngredients();
  }

  returnToLastStep(): void {
    if (this.chefModeScreen !== 'ingredients' || this.lastStepBeforeIngredients < 0) return;

    this.chefModeScreen = 'steps';
    this.currentStepIndex = this.lastStepBeforeIngredients;
    
    setTimeout(() => {
      this.cdr.detectChanges();
      this.speakCurrentStep();
    }, 0);
  }

  toggleStepCompletion(index: number): void {
    if (this.completedSteps.has(index)) {
      this.completedSteps.delete(index);
    } else {
      this.completedSteps.add(index);
    }
  }

  isStepCompleted(index: number): boolean {
    return this.completedSteps.has(index);
  }

  getProgress(): number {
    if (!this.steps?.length) return 0;
    return Math.round((this.completedSteps.size / this.steps.length) * 100);
  }
}