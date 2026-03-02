import { supabase } from '../HTML/index.html'; // optional, already global

let cart = [];
let total = 0;

// Load products from Supabase
async function loadProducts() {
    const { data: products, error } = await supabase
        .from('products')
        .select('*');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    products.forEach(product => {
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4';
        col.innerHTML = `
            <button class="btn btn-primary w-100 product-btn"
                onclick="addToCart('${product.name}', ${product.price})">
                ${product.name}<br>₱${product.price}
            </button>
        `;
        container.appendChild(col);
    });
}

// Cart functions
function addToCart(name, price) {
    const existing = cart.find(item => item.name === name);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ name, price, quantity: 1 });
    }
    calculateTotal();
    renderCart();
}

function calculateTotal() {
    total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function renderCart() {
    const cartList = document.getElementById('cartList');
    cartList.innerHTML = '';

    cart.forEach((item, index) => {
        cartList.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    ${item.name} (₱${item.price})
                    <div class="mt-1">
                        <button class="btn btn-sm btn-outline-secondary" onclick="decreaseQty(${index})">-</button>
                        <span class="mx-2">${item.quantity}</span>
                        <button class="btn btn-sm btn-outline-secondary" onclick="increaseQty(${index})">+</button>
                    </div>
                </div>
                <div>
                    ₱${item.price * item.quantity}
                    <button class="btn btn-sm btn-outline-danger ms-2" onclick="removeItem(${index})">x</button>
                </div>
            </li>
        `;
    });

    document.getElementById('total').innerText = total;
}

function increaseQty(index) {
    cart[index].quantity += 1;
    calculateTotal();
    renderCart();
}

function decreaseQty(index) {
    if (cart[index].quantity > 1) {
        cart[index].quantity -= 1;
    } else {
        removeItem(index);
    }
    calculateTotal();
    renderCart();
}

function removeItem(index) {
    cart.splice(index, 1);
    calculateTotal();
    renderCart();
}

function clearCart() {
    cart = [];
    total = 0;
    renderCart();
}

// Checkout → save order to Supabase
async function checkout() {
    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }

    const orderItems = cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
    }));

    const { data, error } = await supabase
        .from('orders')
        .insert([{ order_items: orderItems, total: total }]);

    if (error) {
        console.error(error);
        alert('Error saving order!');
        return;
    }

    alert(`Order placed! Total: ₱${total}`);
    clearCart();
}

// Load products on page load
window.addEventListener('DOMContentLoaded', loadProducts);