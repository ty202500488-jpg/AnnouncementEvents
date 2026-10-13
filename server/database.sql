-- 1. ROLES
CREATE TABLE roles (
    role_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

-- 2. DEPARTMENTS
CREATE TABLE departments (
    department_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_name VARCHAR(150) NOT NULL,
    department_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    location VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PROGRAMS
CREATE TABLE programs (
    program_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_name VARCHAR(150) NOT NULL,
    department_id INTEGER,
    duration_years INTEGER,
    description TEXT,
    status VARCHAR(50) NOT NULL,
    
    CONSTRAINT fk_programs_department 
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL
);

-- 4. ORGANIZATIONS
CREATE TABLE organizations (
    organization_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_name VARCHAR(150) NOT NULL,
    description TEXT,
    department_id INTEGER, -- nullable
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_organizations_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL
);

-- 5. USERS
CREATE TABLE users (
    user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE, -- nullable for faculty/staff
    role_id INTEGER NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    year_level VARCHAR(50),
    department_id INTEGER, -- nullable
    program_id INTEGER, -- nullable
    status VARCHAR(50) DEFAULT 'Active' NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles(role_id),
    CONSTRAINT fk_users_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_users_program
        FOREIGN KEY (program_id) REFERENCES programs(program_id)
        ON DELETE SET NULL
);

-- 6. PAGES (Owned by Department OR Organization exclusively)
CREATE TABLE pages (
    page_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page_name VARCHAR(150) NOT NULL,
    page_description TEXT,
    department_id INTEGER UNIQUE, -- 1:1 if defined
    organization_id INTEGER UNIQUE, -- 1:1 if defined
    created_by INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pages_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pages_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pages_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id),

    -- Database rule: page must belong to EITHER a department OR an organization, not both.
    CONSTRAINT chk_page_owner_defined 
        CHECK (
            (department_id IS NOT NULL AND organization_id IS NULL) OR 
            (department_id IS NULL AND organization_id IS NOT NULL)
        )
);

-- 7. PAGE_REVIEWS (Approval workflow for pages)
CREATE TABLE page_reviews (
    review_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page_id INTEGER NOT NULL,
    reviewed_by INTEGER NOT NULL,
    decision VARCHAR(50) NOT NULL, -- Approved, Rejected
    remarks TEXT,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reviews_page
        FOREIGN KEY (page_id) REFERENCES pages(page_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reviews_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);

-- 8. PAGE_STAFF (Manage who administers which Page and their active status/turnover)
CREATE TABLE page_staff (
    page_staff_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role_on_page VARCHAR(50) NOT NULL, -- Editor, Admin
    assigned_by INTEGER NOT NULL,
    assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Active' NOT NULL,

    -- Prevent duplicate assignments of the same user to the same page
    CONSTRAINT uq_page_staff_user UNIQUE (page_id, user_id),

    CONSTRAINT fk_staff_page
        FOREIGN KEY (page_id) REFERENCES pages(page_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_staff_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_staff_assigner
        FOREIGN KEY (assigned_by) REFERENCES users(user_id)
);

-- 9. ANNOUNCEMENT_CATEGORIES
CREATE TABLE announcement_categories (
    category_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by INTEGER, -- nullable

    CONSTRAINT fk_category_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON DELETE SET NULL
);

-- 10. ANNOUNCEMENTS
CREATE TABLE announcements (
    announcement_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page_id INTEGER NOT NULL,
    creator_user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(50) DEFAULT 'Published' NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_announcement_page
        FOREIGN KEY (page_id) REFERENCES pages(page_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_announcement_creator
        FOREIGN KEY (creator_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_announcement_category
        FOREIGN KEY (category_id) REFERENCES announcement_categories(category_id)
);

-- 11. EVENTS
CREATE TABLE events (
    event_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page_id INTEGER NOT NULL,
    creator_user_id INTEGER NOT NULL,
    event_title VARCHAR(200) NOT NULL,
    event_description TEXT,
    poster_url TEXT,
    event_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_date TIMESTAMP WITHOUT TIME ZONE,
    location VARCHAR(255),
    organizer_info TEXT,
    registration_deadline TIMESTAMP WITHOUT TIME ZONE,
    capacity INTEGER,
    status VARCHAR(50) DEFAULT 'Upcoming' NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_event_page
        FOREIGN KEY (page_id) REFERENCES pages(page_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_event_creator
        FOREIGN KEY (creator_user_id) REFERENCES users(user_id)
);

-- 12. PAGE_FOLLOWS
CREATE TABLE page_follows (
    follow_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    follower_user_id INTEGER NOT NULL,
    page_id INTEGER NOT NULL,
    followed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate follows
    CONSTRAINT uq_follower_page UNIQUE (follower_user_id, page_id),

    CONSTRAINT fk_follow_user
        FOREIGN KEY (follower_user_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_follow_page
        FOREIGN KEY (page_id) REFERENCES pages(page_id)
        ON DELETE CASCADE
);

-- 13. EVENT_REGISTRATIONS
CREATE TABLE event_registrations (
    registration_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id INTEGER NOT NULL,
    registrant_user_id INTEGER NOT NULL,
    registered_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Registered' NOT NULL, -- Registered, Attended, Cancelled

    -- Prevent duplicate event registrations
    CONSTRAINT uq_registrant_event UNIQUE (event_id, registrant_user_id),

    CONSTRAINT fk_registration_event
        FOREIGN KEY (event_id) REFERENCES events(event_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_registration_user
        FOREIGN KEY (registrant_user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- ==============================================================================
-- AUTOMATIC TIMESTAMPS TRIGGER
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_user_modtime
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_page_modtime
BEFORE UPDATE ON pages
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_announcement_modtime
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();