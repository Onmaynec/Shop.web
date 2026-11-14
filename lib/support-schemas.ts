import {z} from 'zod';

export const ticketCreate=z.object({
  subject:z.string().trim().min(5,'Укажите тему обращения (от 5 символов)').max(120),
  message:z.string().trim().min(10,'Опишите проблему (от 10 символов)').max(4000),
  orderId:z.string().cuid().nullable().optional().default(null)
}).strict();

export const ticketReply=z.object({
  message:z.string().trim().min(2).max(4000),
  internal:z.boolean().optional().default(false)
}).strict();

export const ticketManage=z.object({
  status:z.enum(['OPEN','WAITING_CUSTOMER','CLOSED']).optional(),
  priority:z.enum(['LOW','NORMAL','HIGH']).optional(),
  assignedToId:z.string().cuid().nullable().optional()
}).strict().refine(v=>Object.keys(v).length>0,'Нет изменений');

export const ticketStatusLabel={
  OPEN:'Открыт',WAITING_CUSTOMER:'Ожидает покупателя',CLOSED:'Закрыт'
} as const;

export const ticketPriorityLabel={
  LOW:'Низкий',NORMAL:'Обычный',HIGH:'Высокий'
} as const;
