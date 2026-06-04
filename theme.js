// ========== CONTROL DE TEMA CLARO/OSCURO ==========
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const checkbox = document.getElementById('theme-toggle');
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (checkbox) checkbox.checked = true;
    } else {
        document.body.classList.remove('light-mode');
        if (checkbox) checkbox.checked = false;
    }
    
    if (checkbox) {
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('light-mode');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.classList.remove('light-mode');
                localStorage.setItem('theme', 'dark');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initTheme);