const supabase = require('./src/config/supabase');

async function setupTestUser() {
    console.log('Setting up test user...\n');

    // Check if any users exist
    const { data: existingUsers } = await supabase
        .from('auth.users')
        .select('id, email')
        .limit(1);

    if (existingUsers && existingUsers.length > 0) {
        console.log('✅ Found existing user:', existingUsers[0].email);
        console.log('User ID:', existingUsers[0].id);
        console.log('\nUpdate create-first-requisition.js with this ID:');
        console.log(`created_by: '${existingUsers[0].id}'`);
    } else {
        console.log('No users found. Creating test user...');

        // Create a test user via Supabase Auth
        const { data, error } = await supabase.auth.admin.createUser({
            email: 'system@moonlit.com',
            password: 'SystemTest123!',
            email_confirm: true
        });

        if (error) {
            console.log('Error creating user:', error);
            console.log('\nCreate a user manually in Supabase Dashboard:');
            console.log('1. Go to Authentication → Users');
            console.log('2. Click "Add user" → "Create new user"');
            console.log('3. Email: system@moonlit.com');
            console.log('4. Password: SystemTest123!');
        } else {
            console.log('✅ Created test user!');
            console.log('User ID:', data.user.id);
            console.log('\nUpdate create-first-requisition.js with this ID:');
            console.log(`created_by: '${data.user.id}'`);
        }
    }

    process.exit(0);
}

setupTestUser().catch(console.error);