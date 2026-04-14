// קומפוננטת פרופיל ציבורי - צפייה בפרופיל משתמש אחר ובמתכונים שהעלה

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-profile.component.html',
  styleUrl: './public-profile.component.css'
})
export class PublicProfileComponent implements OnInit {
  profile: any = null;
  loading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
    const userId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadProfile(userId);
  }

  /* טעינת פרופיל המשתמש מהשרת */
  loadProfile(userId: number): void {
    const viewerId = this.userService.getCurrentUser()?.id ?? null;
    
    this.userService.getUserPublicProfile(userId, viewerId).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => this.profile = data,
      error: (err) => console.error('שגיאה בטעינת הפרופיל:', err)
    });
  }

  /* ניווט לעמוד מתכון */
  goToRecipe(recipeId: number): void {
    this.router.navigate(['/recipe', recipeId]);
  }

  /* פורמט תאריך בעברית */
  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    return new Date(dateString).toLocaleDateString('he-IL', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  goBack(): void {
    this.router.navigate(['/recipes']);
  }
}