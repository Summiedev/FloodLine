import { UsersController } from './users.controller';

describe('UsersController', () => {
  it('updates the authenticated user only and does not expose session internals', async () => {
    const usersService = {
      updateBasicProfile: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'person@example.com',
        phoneNumber: null,
        displayName: 'Updated Person',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      }),
    };
    const controller = new UsersController(usersService as never);
    const principal = {
      userId: 'authorized-user',
      sessionId: 'internal-session',
      id: 'authorized-user',
      email: 'person@example.com',
      phoneNumber: null,
      displayName: 'Person',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    } as never;
    const dto = { displayName: 'Updated Person' };
    const request = { ip: '127.0.0.1', get: jest.fn().mockReturnValue(undefined) } as never;

    await controller.updateBasicProfile(principal, dto, request);

    expect(usersService.updateBasicProfile).toHaveBeenCalledWith(
      'authorized-user',
      dto,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
    const currentUser = controller.getCurrentUser(principal);
    expect(currentUser).not.toHaveProperty('sessionId');
    expect(currentUser).not.toHaveProperty('userId');
  });
});
