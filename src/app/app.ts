import { Component, inject, OnInit, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { StepperModule } from 'primeng/stepper';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GoogleAuthService } from './services/google.service';
import { ListboxModule } from 'primeng/listbox';
import { ToolbarModule } from 'primeng/toolbar';
import { MultiSelectModule } from 'primeng/multiselect';
import { forkJoin, Observable, of } from 'rxjs';
import { switchMap, expand, map, reduce, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [
    StepperModule,
    MultiSelectModule,
    FormsModule,
    ListboxModule,
    ButtonModule,
    ToolbarModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  public readonly roles = signal(['Guitarra', 'Tenor', 'Púa']);
  public selectedRoles: any;
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
    if (!this.token()) return;
    this.selectedFiles.forEach((file) => {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', file.name);
      link.style.display = 'none';
      fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${this.token()}` },
      })
        .then((res) => res.blob())
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          link.href = url;
          document.body.appendChild(link);
          link.click(); // fuerza la descarga
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch((err) => console.error(`Error descargando ${file.name}:`, err));
    });
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

  listFolderFiles() {
    const token = this.token();
    const parentId = this.selectedSong.id;

    const headers = { Authorization: `Bearer ${token}` };

    // 👉 1. Obtener todas las subcarpetas (recursivo)
    const getSubfolders: any = (folderId: string) => {
      const query = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      return this.http
        .get<any>('https://www.googleapis.com/drive/v3/files', {
          headers,
          params: { q: query, fields: 'files(id)', pageSize: 1000 },
        })
        .pipe(
          expand((res) => {
            if (!res.nextPageToken) return of();
            return this.http.get<any>('https://www.googleapis.com/drive/v3/files', {
              headers,
              params: { q: query, fields: 'files(id)', pageToken: res.nextPageToken },
            });
          }),
          map((res) => res.files || []),
          reduce((acc, files) => acc.concat(files), []),
          switchMap((folders) => {
            if (!folders.length) return of(folders);
            return forkJoin(folders.map((f: any) => getSubfolders(f.id))).pipe(
              map((subs) => folders.concat(...subs))
            );
          }),
          catchError(() => of([]))
        );
    };

    // 👉 2. Query de hijos directos
    const directQuery = `'${parentId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`;
    const directFiles$ = this.http
      .get<any>('https://www.googleapis.com/drive/v3/files', {
        headers,
        params: {
          q: directQuery,
          fields: 'files(id, name, mimeType, modifiedTime, size, parents)',
          pageSize: 1000,
        },
      })
      .pipe(map((res) => res.files || []));

    // 👉 3. Query de archivos en subcarpetas cuyo nombre coincida
    const matchingInSubfolders$: Observable<any[]> = getSubfolders(parentId).pipe(
      switchMap((subfolders: any) => {
        if (!subfolders.length || !this.selectedRoles?.length) return of([]);

        const subfoldersClause = subfolders.map((f: any) => `'${f.id}' in parents`).join(' or ');
        const nameFilters = this.selectedRoles.map((n: any) => `name contains '${n}'`).join(' or ');

        const query = `(${subfoldersClause}) and (${nameFilters}) and trashed=false and mimeType != 'application/vnd.google-apps.folder'`;

        return this.http
          .get<any>('https://www.googleapis.com/drive/v3/files', {
            headers,
            params: {
              q: query,
              fields: 'files(id, name, mimeType, modifiedTime, size, parents)',
              pageSize: 1000,
            },
          })
          .pipe(map((res) => res.files || []));
      }),
      catchError(() => of([]))
    );

    // 👉 4. Combinar resultados
    forkJoin({
      direct: directFiles$,
      subMatches: matchingInSubfolders$,
    }).subscribe(({ direct, subMatches }) => {
      const allFiles = [...direct, ...subMatches];
      this.files.set(allFiles);
      this.selectedFiles = allFiles;
    });
  }
}
