import { Component, inject, OnInit, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { StepperModule } from 'primeng/stepper';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GoogleAuthService } from './services/google.service';
import { ListboxModule } from 'primeng/listbox';

@Component({
  selector: 'app-root',
  imports: [StepperModule, SelectModule, FormsModule, ListboxModule, ButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  public readonly groups = signal(['Labrantes', 'Facaracas'])
  public selectedGroup = null;
  public readonly roles = signal(['Guitarra', 'Tenor'])
  public selectedRole = null;

  public files = signal<any[] | null>(null)
  public token = signal<string | null>(null)

  public googleAuth = inject(GoogleAuthService)
  public http = inject(HttpClient)

  ngOnInit() {
    this.googleAuth.initClient('275514941907-rj2b6b7a8roccc7qu1f684r76t3gquq7.apps.googleusercontent.com');
    this.googleAuth.token$.subscribe((t) => (this.token.set(t)));
  }

  login() {
    this.googleAuth.requestAccessToken();
    this.listFiles();
  }

  downloadFiles() {
    if (!this.token()) {
      console.error('No hay token disponible');
      return;
    }
    const url = `https://www.googleapis.com/drive/v3/files/${this.files()![17].id}?alt=media`;

    this.http.get(url, {
      headers: { Authorization: `Bearer ${this.token()}` },
      responseType: 'blob'
    }).subscribe((blob: Blob) => {
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = this.files()![17].name;
      link.click();
      URL.revokeObjectURL(objectUrl)
    });
  }

  public listFiles() {
    if (!this.token()) return;
    this.http
      .get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${this.token()}` },
      })
      .subscribe((res: any) => {
        console.log(res.files)
        this.files.set(res.files)
      });
  }
}
