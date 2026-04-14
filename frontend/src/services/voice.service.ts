// שירות Voice Chef - הקראת טקסט וזיהוי פקודות קוליות בעברית

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  private synthesis: SpeechSynthesis;
  private recognition: any;
  private voices: SpeechSynthesisVoice[] = [];
  private hebrewVoice: SpeechSynthesisVoice | null = null;
  private silenceTimeout: any = null;
  
  public currentText: string = '';
  public currentCharIndex: number = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  /* השהיה לפני זיהוי פקודה (מילישניות) */
  public silenceDelay: number = 600;
  public silenceDelayUnknown: number = 1000;
  
  /* רשימת פקודות קוליות מוכרות */
  private knownCommands: string[] = [
    'הבא', 'שלב הבא', 'קודם', 'שלב קודם', 'לפני',
    'שוב', 'חזור על השלב', 'רכיבים', 'התחל', 'תתחיל',
    'שלב ראשון', 'חזור לשלב', 'הייתי', 'עצור', 'עצרו',
    'המשך', 'המשיכו', 'תמשיך', 'סגור', 'סגירה', 'יציאה'
  ];
  
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.loadVoices();
    
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  /* טעינת קולות זמינים ובחירת קול עברי */
  private loadVoices(): void {
    this.voices = this.synthesis.getVoices();
    
    this.hebrewVoice = 
      this.voices.find(voice => voice.lang === 'he-IL') ||
      this.voices.find(voice => voice.lang.startsWith('he')) ||
      this.voices.find(voice => voice.name.includes('Hebrew')) ||
      this.voices[0];
  }

  /* הקראת טקסט בעברית */
  speak(text: string, onEnd?: () => void, startFromChar: number = 0): void {
    this.stopSpeaking();
    this.currentText = text;
    
    const textToSpeak = startFromChar > 0 ? text.substring(startFromChar) : text;
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'he-IL';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    if (this.hebrewVoice) {
      utterance.voice = this.hebrewVoice;
    }
    
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      this.currentCharIndex = startFromChar + event.charIndex;
    };
    
    if (onEnd) {
      utterance.onend = onEnd;
    }
    
    this.currentUtterance = utterance;
    this.synthesis.speak(utterance);
  }

  /* עצירת הקראה נוכחית */
  stopSpeaking(): void {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
  }

  /* בדיקה אם יש הקראה פעילה */
  isSpeaking(): boolean {
    return this.synthesis.speaking;
  }

  /* הפעלת זיהוי דיבור בעברית */
  startListening(
    onResult: (text: string) => void, 
    onError?: (error: any) => void
  ): void {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported');
      onError?.({ error: 'not-supported' });
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'he-IL';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    let lastInterimText = '';
    let lastProcessedCommand = '';
    let lastProcessedTime = 0;
    const commandCooldown = 2000;

    /* עיבוד פקודה עם מניעת כפילויות */
    const processCommand = (text: string) => {
      const now = Date.now();
      const normalizedText = text.toLowerCase().trim();
      const normalizedLast = lastProcessedCommand.toLowerCase().trim();
      
      if (normalizedText === normalizedLast && (now - lastProcessedTime) < commandCooldown) {
        return;
      }
      
      lastProcessedCommand = text;
      lastProcessedTime = now;
      onResult(text);
    };

    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      const text = result[0].transcript.trim();
      const isFinal = result.isFinal;
      
      if (isFinal) {
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
          this.silenceTimeout = null;
        }
        processCommand(text);
        lastInterimText = '';
        return;
      }
      
      /* Interim result - זיהוי לפי שתיקה */
      if (text !== lastInterimText && text.length) {
        lastInterimText = text;
        
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
        }
        
        const delay = this.isKnownCommand(text) ? this.silenceDelay : this.silenceDelayUnknown;
        
        this.silenceTimeout = setTimeout(() => {
          processCommand(lastInterimText);
          lastInterimText = '';
          this.silenceTimeout = null;
        }, delay);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
      onError?.(event);
    };

    this.recognition.onend = () => {
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
      
      /* הפעלה מחדש אוטומטית */
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          console.error('Could not restart recognition:', e);
        }
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error('Could not start recognition:', e);
      onError?.(e);
    }
  }

  /* עצירת זיהוי דיבור */
  stopListening(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }

  /* בדיקת תמיכת הדפדפן ב-Speech Recognition */
  isRecognitionSupported(): boolean {
    return !!(window as any).SpeechRecognition || 
           !!(window as any).webkitSpeechRecognition;
  }

  /* בדיקה אם הטקסט מכיל פקודה מוכרת */
  private isKnownCommand(text: string): boolean {
    const lowerText = text.toLowerCase().trim();
    return this.knownCommands.some(cmd => {
      const lowerCmd = cmd.toLowerCase();
      return lowerText === lowerCmd || lowerText.includes(lowerCmd);
    });
  }
}