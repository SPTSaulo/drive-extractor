import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare const google: any;

@Injectable({
  providedIn: 'root',
})
export class GoogleAuthService {
  private tokenSubject = new BehaviorSubject<string | null>(null);
  token$ = this.tokenSubject.asObservable();

  private client: any;

  initClient(clientId: string) {
    this.client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (response: any) => {
        if (response.access_token) {
          this.tokenSubject.next(response.access_token);
        }
      },
    });
  }

  requestAccessToken() {
    if (this.client) {
      this.client.requestAccessToken();
    }
  }

  logout() {
    this.tokenSubject.next(null);
  }
}
