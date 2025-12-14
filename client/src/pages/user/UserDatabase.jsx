import DatabaseView from '../DatabaseView';

/**
 * User Database View - Read-only version for regular users
 * Reuses the existing DatabaseView component
 */
export default function UserDatabase() {
    return <DatabaseView />;
}
