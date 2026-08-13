import Product from '../models/Product.js';

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
    try {
        const products = await Product.find({}).populate('supplier', 'name email');
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('supplier', 'name email');
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Supplier/Admin
export const createProduct = async (req, res) => {
    try {
        const { name, image, description, price, quantity } = req.body;

        const product = new Product({
            name,
            image,
            description,
            price,
            quantity,
            supplier: req.user._id,
        });

        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Supplier/Admin
export const updateProduct = async (req, res) => {
    try {
        const { name, image, description, price, quantity } = req.body;

        const product = await Product.findById(req.params.id);

        if (product) {
            // Check if user is owner or admin
            if (product.supplier.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
                return res.status(401).json({ message: 'Not authorized to update this product' });
            }

            product.name = name || product.name;
            product.image = image || product.image;
            product.description = description || product.description;
            product.price = price || product.price;
            product.quantity = quantity || product.quantity;

            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Supplier/Admin
export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (product) {
             if (product.supplier.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
                return res.status(401).json({ message: 'Not authorized to delete this product' });
            }
            await Product.deleteOne({ _id: product._id });
            res.json({ message: 'Product removed' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
