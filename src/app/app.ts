import { Component, inject, OnInit, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { StepperModule } from 'primeng/stepper';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GoogleAuthService } from './services/google.service';
import { ListboxModule } from 'primeng/listbox';
import { ToolbarModule } from 'primeng/toolbar';

@Component({
  selector: 'app-root',
  imports: [StepperModule, SelectModule, FormsModule, ListboxModule, ButtonModule, ToolbarModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  public readonly roles = signal(['Guitarra', 'Tenor']);
  public selectedRole = null;

  public folders = signal<any[] | null>(null);
  public selectedFolder: any;
  public songs = signal<any[] | null>(null);
  public selectedSong: any;
  public files = signal<any[] | null>(null);
  public selectedFiles: any[] = [];
  public token = signal<string | null>(null);

  public googleAuth = inject(GoogleAuthService);
  public http = inject(HttpClient);

  ngOnInit() {
    this.googleAuth.initClient(
      '275514941907-rj2b6b7a8roccc7qu1f684r76t3gquq7.apps.googleusercontent.com'
    );
    this.googleAuth.token$.subscribe((t) => {
      this.token.set(t);
      this.listFolders();
    });
  }

  login() {
    this.googleAuth.requestAccessToken();
  }

  downloadFiles() {
    if (!this.token()) {
      console.error('No hay token disponible');
      return;
    }
    console.log(this.selectedFiles);
  }

  public listFolders() {
    if (!this.token()) return;
    this.http
      .get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${this.token()}` },
        params: {
          q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
          fields: 'files(id, name)',
          pageSize: 1000,
        },
      })
      .subscribe((res: any) => this.folders.set(res.files));
  }

  public listSongs() {
    const token = this.token();
    if (!token) return;

    this.http
      .get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          q: `'${this.selectedFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
          pageSize: 1000,
        },
      })
      .subscribe((res: any) => this.songs.set(res.files));
  }

  public listFolderFiles() {
    if (!this.token()) return;
    this.http
      .get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${this.token()}` },
        params: {
          q: `'${this.selectedSong.id}' in parents and trashed=false`,
          fields: 'files(id, name, mimeType, modifiedTime, size)',
          pageSize: 1000,
        },
      })
      .subscribe((res: any) => {
        this.files.set(res.files);
        this.selectedFiles = res.files;
      });
  }
}
