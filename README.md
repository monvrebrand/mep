# Santander Bank (Schweiz) AG - Frontend Prototype

This project is a frontend prototype for a fictional online banking portal for "Santander Bank (Schweiz) AG". It includes various static pages for public information, as well as a dynamic customer dashboard for managing accounts and transactions.

## Features

*   **Public Pages**: Informational pages for different banking sectors:
    *   Personal, Private, Business, and Corporate Banking.
*   **User Authentication**:
    *   User Registration (`register.html`) and Login (`login.html`).
    *   Password Reset (`forgotten-details.html`).
*   **Customer Dashboard (`inside.html`)**:
    *   Account overview with balances.
    *   Quick actions for common tasks.
*   **Account Management**:
    *   View detailed transaction history (`transactions.html`).
    *   Download account statements as PDF (`statements.html`).
    *   Transfer funds between own accounts (`transfer.html`).
    *   Make payments to external accounts (`make-payment.html`).
    *   Update user profile and security settings (`account-settings.html`).
*   **Admin Panel**:
    *   Secure admin login (`admin-login.html`).
    *   Dashboard to view customer messages, live chat sessions, and new account registrations (`admin-messages.html`).

## Technology Stack

*   **HTML5**
*   **CSS3** with Bootstrap 5 for styling and layout.
*   **JavaScript**: Vanilla JavaScript for client-side interactivity and API communication.
*   **Vendor Libraries**: Includes Bootstrap, AOS (Animate On Scroll), Glightbox, Isotope, and Swiper.

## Getting Started

This is a frontend-only project. To be fully functional, it requires a backend API service that provides the endpoints consumed by the JavaScript code, such as `/api/login`, `/api/register`, `/api/user/{username}/dashboard`, `/api/transfer`, etc.

To view the static pages, you can open the `.html` files directly in your web browser. For the dynamic features to work, you must run the project on a local web server and have the corresponding backend running.

## Project Structure

*   `*.html`: HTML files for each page of the website.
*   `/css`: Contains the main stylesheet `main.css`.
*   `/js`: Contains `main.js` and other scripts.
*   `/vendor`: Contains third-party libraries.
*   `/img`: Contains images and logos.
