CREATE DATABASE announcement_events;

-- 1. Role Table
CREATE TABLE Role (
    role_id INT PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL,
    role_description TEXT
);

-- 2. Departments Table
CREATE TABLE Departments (
    department_id INT PRIMARY KEY,
    department_name VARCHAR(150) NOT NULL,
    department_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL
);

-- 3. Organization Table
CREATE TABLE Organization (
    organization_id INT PRIMARY KEY,
    organization_name VARCHAR(150) NOT NULL,
    description TEXT,
    department_id INT,
    status VARCHAR(50) NOT NULL,
    FOREIGN KEY (department_id) REFERENCES Departments(department_id)
);

-- 4. User Table
CREATE TABLE User (
    user_id INT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    mi VARCHAR(10),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role_id INT,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES Role(role_id)
);

-- 5. Page Table
CREATE TABLE Page (
    page_id INT PRIMARY KEY,
    page_name VARCHAR(150) NOT NULL,
    page_type VARCHAR(50) NOT NULL,
    department_id INT,
    organization_id INT,
    description TEXT,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES Departments(department_id),
    FOREIGN KEY (organization_id) REFERENCES Organization(organization_id)
);

-- 6. Page_Staff Table
CREATE TABLE Page_Staff (
    page_staff_id INT PRIMARY KEY,
    page_id INT,
    user_id INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    FOREIGN KEY (page_id) REFERENCES Page(page_id),
    FOREIGN KEY (user_id) REFERENCES "User"(user_id)
);

-- 7. Announcement_Category Table
CREATE TABLE Announcement_Category (
    category_id INT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 8. Event Table
CREATE TABLE Event (
    event_id INT PRIMARY KEY,
    page_id INT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    posted_url VARCHAR(255),
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue VARCHAR(255),
    organizer_name VARCHAR(150),
    capacity INT,
    registration_required BOOLEAN,
    registration_link VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updateted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES Page(page_id),
    FOREIGN KEY (created_by) REFERENCES "User"(user_id)
);

-- 9. Announcement Table
CREATE TABLE Announcement (
    announcement_id INT PRIMARY KEY,
    page_id INT,
    category_id INT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    poster_url VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    publish_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES Page(page_id),
    FOREIGN KEY (category_id) REFERENCES Announcement_Category(category_id),
    FOREIGN KEY (created_by) REFERENCES "User"(user_id)
);

-- 10. Event_Registration Table
CREATE TABLE Event_Registration (
    registration_id INT PRIMARY KEY,
    event_id INT,
    user_id INT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attendance_status VARCHAR(50),
    registration_status VARCHAR(50),
    FOREIGN KEY (event_id) REFERENCES Event(event_id),
    FOREIGN KEY (user_id) REFERENCES "User"(user_id)
);