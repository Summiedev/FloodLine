import { Injectable, NotFoundException } from '@nestjs/common';
import type { AlertHistoryQueryDto } from './dto/alert-history-query.dto';
import { AlertHistoryRepository } from './alert-history.repository';

@Injectable()
export class AlertHistoryService {
  constructor(private readonly repository: AlertHistoryRepository) {}

  list(userId: string, query: AlertHistoryQueryDto) {
    return this.repository.list({
      userId,
      page: query.page,
      pageSize: query.pageSize,
      unread: query.unread,
      severity: query.severity,
      category: query.category,
    });
  }

  async findOwned(userId: string, alertId: string) {
    const alert = await this.repository.findOwnedById(userId, alertId);
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async markRead(userId: string, alertId: string): Promise<void> {
    if (!(await this.repository.markRead(userId, alertId))) {
      throw new NotFoundException('Alert not found');
    }
  }

  async markAllRead(userId: string): Promise<{ updatedCount: number }> {
    return { updatedCount: await this.repository.markAllRead(userId) };
  }
}
