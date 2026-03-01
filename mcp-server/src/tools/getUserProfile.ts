import { UserProfile } from '../types';

export const TOOL_DEFINITION = {
  name: 'get_user_profile',
  description: 'Retrieve the full profile for a GrabOn user by user_id.',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The unique user identifier (e.g. "user_001")',
      },
    },
    required: ['user_id'],
  },
};

export function getUserProfile(
  users: UserProfile[],
  args: { user_id: string }
): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  const profile = users.find(u => u.user_id === args.user_id);
  if (!profile) {
    return {
      content: [{ type: 'text', text: `User not found: ${args.user_id}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }],
  };
}
