import { Button, Form, Input } from 'antd'
import { useState } from 'react' // хук для измененения состояний компонента
import { AuthService } from '../../services/auth.service' // класс с методами для авторизации и регистрации пользователей

const validateMessages = {
    required: 'Обязательное поле!',
    string: { min: 'Минимум 8 символов!' }
}

const authService = new AuthService()

function LoginForm(props) { // компонент React для формы и логики регистрации и авторизации
    const [isLogin, setIsLogin] = useState(true) // хук для измененения состояний компонента
    const [authErrorMessage, setAuthErrorMessage] = useState('')
    const [form] = Form.useForm()

    async function auth() { // обработка авторизации или регистрации пользователя
        form
            .validateFields()
            .then(async () => {
                if (form.getFieldsValue().passwordRepeat) { // если есть поле повторения пароля, то это регистрация
                    const res = await authService.register(form.getFieldsValue())
                    if (res.success) {
                        props.setCurrentUserInfo(res.userInfo)
                        props.setIsLoggedIn()
                        window.location.href = '/'
                    } else {
                        setAuthErrorMessage('Такой логин уже есть!')
                    }
                } else { // если нет поля повторения пароля, это авторизация
                    const res = await authService.login(form.getFieldsValue())
                    if (res.success) {
                        props.setCurrentUserInfo(res.userInfo)
                        props.setIsLoggedIn()
                        window.location.href = '/'
                    } else {
                        setAuthErrorMessage('Не верные логин или пароль!')
                    }
                }
            })
            .catch(err => {
                console.log('error', err)
            })
    }

    function changeAuthType() { //смена - авторизация или регистрация
        setAuthErrorMessage('')
        setIsLogin(!isLogin)
        form.resetFields()
    }

    async function repeatPasswordFieldValidation(formRecord) { // проверка совпадения паролей
        const passwordField = formRecord.getFieldValue('password')
        const passwordRepeatField = formRecord.getFieldValue('passwordRepeat')
        if (passwordRepeatField && passwordField !== passwordRepeatField) {
            throw Error('Пароли не совпадают!')
        }
    }

    return (
        <>
            <div className='login-page'>
                <div className='login-form-wrapper'>
                    <h1>{isLogin ? 'Авторизация' : 'Регистрация'}</h1>
                    <Form
                        labelAlign='left'
                        labelCol={{ span: 7 }}
                        wrapperCol={{ span: 18 }}
                        form={form}
                        validateMessages={validateMessages}
                    >
                        {!isLogin ? (
                            <>
                                <Form.Item
                                    label='Имя'
                                    name='first_name'
                                    rules={[{required: true}]}
                                >
                                    <Input allowClear />
                                </Form.Item>
                                <Form.Item
                                    label='Фамилия'
                                    name='last_name'
                                    rules={[{required: true}]}
                                >
                                    <Input allowClear />
                                </Form.Item>
                                <Form.Item
                                    label='Дата рождения'
                                    name='date_of_birth'
                                    labelCol={{ span: 10 }}
                                    rules={[{ required: true }]}
                                >
                                    <Input
                                        type="date"
                                        onChange={e => form.setFieldsValue({ date_of_birth: e.target.value })}
                                        //value={form.getFieldValue('date_of_birth')}
                                    />
                                </Form.Item>
                            </>
                        ) : (
                            <></>
                        )}
                        <Form.Item
                            label='Эл. почта'
                            name='email'
                            rules={[
                                {
                                    required: true
                                }
                            ]}
                        >
                            <Input allowClear />
                        </Form.Item>
                        <Form.Item
                            label='Пароль'
                            name='password'
                            rules={[
                                {
                                    required: true,
                                    min: 8
                                }
                            ]}
                        >
                            <Input.Password allowClear />
                        </Form.Item>
                        {!isLogin ? (
                            <Form.Item
                                label='Повтор'
                                name='passwordRepeat'
                                rules={[
                                    {
                                        required: true
                                    },
                                    form => ({
                                        validator() {
                                            return repeatPasswordFieldValidation(form)
                                        }
                                    })
                                ]}
                            >
                                <Input.Password allowClear />
                            </Form.Item>
                        ) : (
                            <></>
                        )}
                    </Form>
                    {authErrorMessage ? <div className='auth-error-message'>{authErrorMessage}</div> : <></>}
                    <Button type='primary' onClick={auth} style={{ width: 200 }}>
                        {isLogin ? 'Войти' : 'Зарегистрироваться'}
                    </Button>
                    <p>
                        {isLogin ? 'Еще не зарегистрированы?' : 'Если есть аккаунт, можете в него войти👉'}
                        <Button type='link' onClick={changeAuthType}>
                            {isLogin ? 'Зарегистрироваться' : 'Авторизоваться'}
                        </Button>
                    </p>
                </div>
            </div>
        </>
    )
}

export default LoginForm
