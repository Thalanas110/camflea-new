document.getElementById('signupForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const fname = document.getElementById('firstName').value;
    const lname = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const school = document.getElementById('school').value;
    const phone = document.getElementById('phoneNumber').value;


    const response = await fetch('/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fname, lname, email, password, school, phone }),
    });

    const data = await response.json();
    if (data.success) {
        alert('Signup successful!');
        window.location.href = `MFA.html?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    } else {
        alert('Signup failed: ' + data.message);
    }
});