import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../core/database';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class DashboardComponent implements OnInit {
  ready = false;

  constructor(private db: DatabaseService) {}

  async ngOnInit(): Promise<void> {
    await this.db.open();
    this.ready = true;
  }
}
