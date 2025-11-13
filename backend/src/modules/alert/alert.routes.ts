import { Router } from 'express';
import { AlertController } from './alert.controller';
import { authenticate } from '../../middleware/auth.middleware';
import {
  validateCreateAlert,
  validateGetAlerts,
  validateAlertId,
  validate,
} from './alert.validation';

const router = Router();
const alertController = new AlertController();

// Apply authentication to all routes
router.use(authenticate);

// Budget status endpoint
router.get('/budget/status', alertController.getBudgetStatus);

// Check expiring items endpoint
router.post('/check-expiring', alertController.checkExpiringItems);

// Alert CRUD endpoints
router.post('/', validateCreateAlert, validate, alertController.createAlert);
router.get('/', validateGetAlerts, validate, alertController.getAlerts);
router.get('/stats', alertController.getStats);
router.get('/:id', validateAlertId, validate, alertController.getAlertById);
router.patch('/:id/read', validateAlertId, validate, alertController.markAsRead);
router.patch('/:id/dismiss', validateAlertId, validate, alertController.dismissAlert);
router.delete('/:id', validateAlertId, validate, alertController.deleteAlert);

export default router;
