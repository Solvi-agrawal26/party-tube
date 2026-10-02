import { Role, ActionType } from '../types';

export class RoleManager {
  /**
   * Only HOST and MODERATOR can directly control playback (play, pause, seek, change video)
   */
  public static canDirectlyControlPlayback(role: Role): boolean {
    return role === 'HOST' || role === 'MODERATOR';
  }

  /**
   * Only HOST and MODERATOR can approve or reject participant action requests
   */
  public static canApproveRequests(role: Role): boolean {
    return role === 'HOST' || role === 'MODERATOR';
  }

  /**
   * Only the HOST can assign/promote/demote roles
   */
  public static canAssignRole(role: Role): boolean {
    return role === 'HOST';
  }

  /**
   * Only the HOST can remove participants from a room
   */
  public static canRemoveParticipant(role: Role): boolean {
    return role === 'HOST';
  }

  /**
   * Only the HOST can transfer ownership to another participant
   */
  public static canTransferHost(role: Role): boolean {
    return role === 'HOST';
  }

  /**
   * All participants and viewers can submit playback requests for approval
   */
  public static canRequestAction(role: Role): boolean {
    return role === 'PARTICIPANT' || role === 'VIEWER';
  }

  /**
   * Validate if a given role is allowed to perform a given action
   */
  public static isActionAllowed(role: Role, action: ActionType): boolean {
    return this.canDirectlyControlPlayback(role);
  }
}
