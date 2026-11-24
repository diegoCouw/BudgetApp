import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-lock',
  templateUrl: './lock.html',
  styleUrls: ['./lock.scss'],
})
export class LockComponent implements OnInit {
  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.unlock();
  }

  async unlock(): Promise<void> {
    const ok = await this.auth.tryUnlock();
    if (ok) this.router.navigateByUrl('/');
  }
}
