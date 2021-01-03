import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerFound = await this.customersRepository.findById(customer_id)

    if (!customerFound) {
      throw new AppError('Customer not found')
    }

    const productsFound = await this.productsRepository.findAllById(products)

    if(!productsFound.length) {
      throw new AppError('inform an existing product')
    }

    const idsFound = productsFound.map(product => product.id)

    const filteredIds = products.filter(
      product => !idsFound.includes(product.id)
    )

    if(filteredIds.length){
      throw new AppError(`Could not find product${JSON.stringify(filteredIds)}`)
    }

    const productWithinQuantityAvailable = products.filter(
      productRequest => productsFound.filter(
          product => product.id === productRequest.id
        )[0].quantity < productRequest.quantity
    )

    if(productWithinQuantityAvailable.length){
      throw new AppError(`The quantity ${productWithinQuantityAvailable[0].quantity} is not available for product ${productWithinQuantityAvailable[0].id}`)
    }

     const formattedProducts = products.map( product => ({
       product_id: product.id,
       quantity: product.quantity,
       price: productsFound.filter(p => p.id === product.id)[0].price
     }))

     const order = await this.ordersRepository.create({
       customer: customerFound,
       products: formattedProducts,
     })

     const productsUpdatedQuantity = products.map(product => ({
       id: product.id,
       quantity: productsFound.filter( p => p.id === product.id)[0].quantity -
         product.quantity
     }))

     await this.productsRepository.updateQuantity(productsUpdatedQuantity)

     return order

  }
}

export default CreateOrderService;
